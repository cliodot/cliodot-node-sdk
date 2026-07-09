#!/usr/bin/env node
const path = require("path");
const fs = require("fs");
const readline = require("readline");

const rootEnv = path.resolve(__dirname, "../../.env");
if (fs.existsSync(rootEnv)) {
  try {
    require("dotenv").config({ path: rootEnv });
  } catch {
    // optional when run with -r dotenv/config
  }
}

let AuthAppClient;
try {
  ({ AuthAppClient } = require("../dist"));
} catch {
  console.error("SDK not built. Run: cd cliodot-flosync && npm run build");
  process.exit(1);
}

const COMMANDS = [
  "upsert",
  "status",
  "enroll",
  "confirm",
  "verify",
  "disable",
  "reset",
  "recovery",
  "recovery-verify",
];

function printHelp() {
  console.log(`
Auth App MFA CLI (SDK) — uses AuthAppClient from the cliodot package only.

Usage:
  npm run auth-app-mfa-sdk -- <appId> <command> [options]
  npm run auth-app-mfa-sdk -- <appId>                    # interactive menu

Commands:
  upsert           client.users.upsert
  status           client.mfa.status
  enroll           client.mfa.totp.enroll
  confirm          client.mfa.totp.confirm
  verify           client.mfa.totp.verify
  disable          client.mfa.totp.disable
  reset            client.mfa.totp.reset
  recovery         client.mfa.recoveryCodes.generate
  recovery-verify  client.mfa.recoveryCodes.verify

Options (flags):
  --user <id>        external_user_id (required for most commands)
  --code <code>      TOTP or recovery code
  --email <email>    for upsert
  --name <name>      display_name for upsert
  --label <label>    authenticator label for enroll/reset
  --reset            force re-enroll on enroll
  --app-id <id>      auth app _id (alternative to first positional arg)

Env vars:
  CLIODOT_BASE_URL     Public API origin (default: http://localhost:8901)
  AUTH_APP_ID          Auth app _id (if not passed as argument)
  AUTH_APP_API_KEY     aak_... (preferred)
  AUTH_APP_SECRET      app secret (alternative to app API key)

Examples:
  npm run auth-app-mfa-sdk -- auth_app_xxx status --user user_123
  npm run auth-app-mfa-sdk -- auth_app_xxx enroll --user user_123 --label user@example.com
  npm run auth-app-mfa-sdk -- auth_app_xxx confirm --user user_123 --code 123456

Prerequisite: cd cliodot-flosync && npm run build
`);
}

function parseArgs(argv) {
  const positional = [];
  const flags = {};

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") {
      flags.help = true;
      continue;
    }
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith("--")) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = true;
      }
      continue;
    }
    positional.push(arg);
  }

  return { positional, flags };
}

function stateFilePath(appId, externalUserId) {
  return path.join(process.cwd(), `.auth-mfa-sdk-${appId}-${externalUserId}.json`);
}

function saveState(appId, externalUserId, data) {
  const file = stateFilePath(appId, externalUserId);
  fs.writeFileSync(
    file,
    JSON.stringify({ ...data, saved_at: new Date().toISOString() }, null, 2)
  );
  console.log(`State saved: ${file}`);
}

function saveQrFromEnroll(user, result) {
  if (!result.qr_code_data_url?.startsWith("data:image")) return;
  const out = path.join(process.cwd(), `auth-mfa-sdk-qr-${user}.png`);
  const b64 = result.qr_code_data_url.replace(/^data:image\/\w+;base64,/, "");
  fs.writeFileSync(out, Buffer.from(b64, "base64"));
  console.log(`QR saved: ${out}`);
}

async function runCommand(client, appId, command, flags) {
  const user = flags.user;
  if (!user) {
    throw new Error("--user <external_user_id> is required");
  }

  switch (command) {
    case "upsert": {
      const result = await client.users.upsert(user, {
        email: flags.email,
        display_name: flags.name,
      });
      console.log(JSON.stringify(result, null, 2));
      return;
    }
    case "status": {
      const result = await client.mfa.status(user);
      console.log(JSON.stringify(result, null, 2));
      return;
    }
    case "enroll": {
      const result = await client.mfa.totp.enroll(user, {
        label: flags.label || flags.email || user,
        reset: flags.reset === true || flags.reset === "true",
      });
      saveState(appId, user, result);
      console.log("\nEnrollment started.");
      console.log(`Secret: ${result.secret}`);
      console.log(`OTPAuth URL: ${result.otpauth_url}`);
      console.log(`Pending expires: ${result.pending_expires_at}`);
      saveQrFromEnroll(user, result);
      console.log(JSON.stringify(result, null, 2));
      return;
    }
    case "confirm": {
      if (!flags.code) throw new Error("--code is required for confirm");
      const result = await client.mfa.totp.confirm(user, flags.code);
      console.log(JSON.stringify(result, null, 2));
      return;
    }
    case "verify": {
      if (!flags.code) throw new Error("--code is required for verify");
      const result = await client.mfa.totp.verify(user, flags.code);
      console.log(JSON.stringify(result, null, 2));
      return;
    }
    case "disable": {
      const result = await client.mfa.totp.disable(user);
      console.log(JSON.stringify(result, null, 2));
      return;
    }
    case "reset": {
      const result = await client.mfa.totp.reset(user, {
        label: flags.label || flags.email || user,
      });
      saveState(appId, user, result);
      saveQrFromEnroll(user, result);
      console.log(JSON.stringify(result, null, 2));
      return;
    }
    case "recovery": {
      const result = await client.mfa.recoveryCodes.generate(user);
      saveState(appId, user, {
        recovery_codes: result.codes,
        batch_id: result.batch_id,
      });
      console.log("\nRecovery codes (save these now):");
      for (const code of result.codes || []) {
        console.log(`  ${code}`);
      }
      console.log(JSON.stringify(result, null, 2));
      return;
    }
    case "recovery-verify": {
      if (!flags.code) throw new Error("--code is required for recovery-verify");
      const result = await client.mfa.recoveryCodes.verify(user, flags.code);
      console.log(JSON.stringify(result, null, 2));
      return;
    }
    default:
      throw new Error(`Unknown command: ${command}`);
  }
}

function prompt(rl, question) {
  return new Promise((resolve) => rl.question(question, resolve));
}

async function interactiveLoop(client, appId, defaultUser) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  let currentUser = defaultUser || process.env.AUTH_MFA_USER || "";

  console.log("\nAuth App MFA (SDK) — interactive mode");
  console.log(`App: ${appId}`);
  console.log("Client: AuthAppClient");

  while (true) {
    if (!currentUser) {
      currentUser = (await prompt(rl, "\nexternal_user_id> ")).trim();
      if (!currentUser) continue;
    }

    console.log(`\nUser: ${currentUser}`);
    console.log("  1. upsert");
    console.log("  2. status");
    console.log("  3. enroll");
    console.log("  4. confirm");
    console.log("  5. verify");
    console.log("  6. disable");
    console.log("  7. reset");
    console.log("  8. recovery codes");
    console.log("  9. recovery verify");
    console.log("  u. change user");
    console.log("  0. exit");

    const choice = (await prompt(rl, "choice> ")).trim().toLowerCase();
    if (choice === "0" || choice === "q" || choice === "exit") break;
    if (choice === "u") {
      currentUser = (await prompt(rl, "external_user_id> ")).trim();
      continue;
    }

    const map = {
      "1": "upsert",
      "2": "status",
      "3": "enroll",
      "4": "confirm",
      "5": "verify",
      "6": "disable",
      "7": "reset",
      "8": "recovery",
      "9": "recovery-verify",
    };
    const command = map[choice];
    if (!command) {
      console.log("Invalid choice");
      continue;
    }

    const flags = { user: currentUser, "app-id": appId };
    if (command === "upsert") {
      flags.email = (await prompt(rl, "email (optional)> ")).trim() || undefined;
      flags.name = (await prompt(rl, "display name (optional)> ")).trim() || undefined;
    }
    if (["confirm", "verify", "recovery-verify"].includes(command)) {
      flags.code = (await prompt(rl, "code> ")).trim();
    }
    if (["enroll", "reset"].includes(command)) {
      flags.label = (await prompt(rl, "label (optional)> ")).trim() || undefined;
    }

    try {
      await runCommand(client, appId, command, flags);
    } catch (err) {
      console.error(`Error: ${err.message}${err.code ? ` (${err.code})` : ""}`);
    }
  }

  rl.close();
}

function buildSdkClient(appId, baseUrl, appApiKey, appSecret) {
  return new AuthAppClient({
    baseUrl,
    appId,
    appApiKey,
    appSecret,
  });
}

async function main() {
  const { positional, flags } = parseArgs(process.argv.slice(2));

  if (flags.help) {
    printHelp();
    process.exit(0);
  }

  const appId = flags["app-id"] || positional[0] || process.env.AUTH_APP_ID;
  const command = positional[1];
  const baseUrl = process.env.CLIODOT_BASE_URL || "http://localhost:8901";
  const appApiKey = process.env.AUTH_APP_API_KEY;
  const appSecret = process.env.AUTH_APP_SECRET;

  if (!appId) {
    console.error("Missing app id. Pass as first argument or set AUTH_APP_ID.");
    printHelp();
    process.exit(1);
  }

  if (!appApiKey && !appSecret) {
    console.error("Set AUTH_APP_API_KEY or AUTH_APP_SECRET.");
    process.exit(1);
  }

  const client = buildSdkClient(appId, baseUrl, appApiKey, appSecret);

  if (!command) {
    await interactiveLoop(client, appId, flags.user);
    return;
  }

  if (!COMMANDS.includes(command)) {
    console.error(`Unknown command: ${command}`);
    printHelp();
    process.exit(1);
  }

  await runCommand(client, appId, command, flags);
}

main().catch((err) => {
  console.error(
    JSON.stringify(
      {
        message: err.message,
        code: err.code,
        status: err.status,
      },
      null,
      2
    )
  );
  process.exit(1);
});
