#!/usr/bin/env node
const path = require("path");
const fs = require("fs");
const readline = require("readline");

const rootEnv = path.resolve(__dirname, "../../.env");
if (fs.existsSync(rootEnv)) {
  try {
    require("dotenv").config({ path: rootEnv });
  } catch {
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
  "enroll",
  "resend",
  "challenge",
  "verify",
  "status",
  "disable",
  "flow",
];

function printHelp() {
  console.log(`
Auth App Email OTP CLI (SDK) — uses client.providers.emailOtp from the cliodot package.

Usage:
  npm run auth-app-email-otp-sdk -- <appId> <command> [options]
  npm run auth-app-email-otp-sdk -- <appId>                    # interactive menu

Commands:
  upsert     client.users.upsert (set email on user record)
  enroll     client.providers.emailOtp.enroll (send first OTP)
  resend     client.providers.emailOtp.resend
  challenge  client.providers.emailOtp.challenge
  verify     client.providers.emailOtp.verify
  status     client.providers.emailOtp.status
  disable    client.providers.emailOtp.disable
  flow       upsert + enroll + prompt for code + verify (end-to-end test)

Options:
  --user <id>              external_user_id (required for most commands)
  --email <email>          recipient email (upsert + enroll)
  --code <code>            OTP code from email
  --subject <text>         custom_subject override on send
  --body <text>            custom_body override on send
  --cc <email>             optional CC on send
  --app-id <id>            auth app _id (alternative to first positional arg)

Env vars:
  CLIODOT_BASE_URL         Public API origin (default: http://localhost:8901)
  AUTH_APP_ID              Auth app _id
  AUTH_APP_API_KEY         aak_... (preferred)
  AUTH_APP_SECRET          app secret (alternative)
  AUTH_EMAIL_OTP_USER       default external_user_id
  AUTH_EMAIL_OTP_EMAIL     default recipient email

Prerequisites:
  1. Auth app has email_otp enabled with delivery + content configured
  2. cd cliodot-flosync && npm run build

Examples:
  npm run auth-app-email-otp-sdk -- auth_app_xxx upsert --user user_123 --email you@example.com
  npm run auth-app-email-otp-sdk -- auth_app_xxx enroll --user user_123 --email you@example.com
  npm run auth-app-email-otp-sdk -- auth_app_xxx verify --user user_123 --code 123456
  npm run auth-app-email-otp-sdk -- auth_app_xxx flow --user user_123 --email you@example.com
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

function buildSendInput(flags) {
  const input = {};
  if (flags.email) input.email = flags.email;
  if (flags.subject) input.custom_subject = flags.subject;
  if (flags.body) input.custom_body = flags.body;
  if (flags.cc) input.cc = flags.cc;
  return Object.keys(input).length ? input : undefined;
}

function printSendResult(result) {
  if (result.sent) {
    console.log(`OTP sent. Expires at: ${result.expires_at || "unknown"}`);
  } else if (result.queued) {
    console.log(
      `OTP queued. Position: ${result.position}, scheduled: ${result.scheduled_at || "unknown"}`
    );
  }
  console.log(JSON.stringify(result, null, 2));
}

async function runCommand(client, command, flags) {
  const user = flags.user || process.env.AUTH_EMAIL_OTP_USER;
  if (!user) {
    throw new Error("--user <external_user_id> is required (or set AUTH_EMAIL_OTP_USER)");
  }

  const email = flags.email || process.env.AUTH_EMAIL_OTP_EMAIL;
  const sendInput = buildSendInput({ ...flags, email: flags.email || email });

  switch (command) {
    case "upsert": {
      if (!email) throw new Error("--email is required for upsert");
      const result = await client.users.upsert(user, { email });
      console.log(JSON.stringify(result, null, 2));
      return;
    }
    case "enroll": {
      if (!sendInput?.email) throw new Error("--email is required for enroll");
      const result = await client.providers.emailOtp.enroll(user, sendInput);
      printSendResult(result);
      return;
    }
    case "resend": {
      const result = await client.providers.emailOtp.resend(user, sendInput);
      printSendResult(result);
      return;
    }
    case "challenge": {
      const result = await client.providers.emailOtp.challenge(user, sendInput);
      printSendResult(result);
      return;
    }
    case "verify": {
      if (!flags.code) throw new Error("--code is required for verify");
      const result = await client.providers.emailOtp.verify(user, flags.code);
      console.log(
        result.verified
          ? `Verified (${result.method}, status: ${result.enrollment_status})`
          : "Verification failed"
      );
      console.log(JSON.stringify(result, null, 2));
      return;
    }
    case "status": {
      const result = await client.providers.emailOtp.status(user);
      console.log(JSON.stringify(result, null, 2));
      return;
    }
    case "disable": {
      const result = await client.providers.emailOtp.disable(user);
      console.log(JSON.stringify(result, null, 2));
      return;
    }
    case "flow": {
      if (!email) throw new Error("--email is required for flow");
      console.log("\n1/3 Upsert user...");
      await client.users.upsert(user, { email });
      console.log("2/3 Enroll + send OTP...");
      const enroll = await client.providers.emailOtp.enroll(user, { email });
      printSendResult(enroll);
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
      const code = await new Promise((resolve) => {
        rl.question("\nEnter OTP code from email> ", (answer) => {
          rl.close();
          resolve(answer.trim());
        });
      });
      if (!code) throw new Error("Code is required");
      console.log("3/3 Verify...");
      const verify = await client.providers.emailOtp.verify(user, code);
      console.log(
        verify.verified
          ? `\nSuccess — email OTP active for ${user}`
          : "\nVerification failed"
      );
      console.log(JSON.stringify(verify, null, 2));
      return;
    }
    default:
      throw new Error(`Unknown command: ${command}`);
  }
}

function prompt(rl, question) {
  return new Promise((resolve) => rl.question(question, resolve));
}

async function interactiveLoop(client, defaultUser) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  let currentUser = defaultUser || process.env.AUTH_EMAIL_OTP_USER || "";
  let currentEmail = process.env.AUTH_EMAIL_OTP_EMAIL || "";

  console.log("\nAuth App Email OTP (SDK) — interactive mode");
  console.log("Client: AuthAppClient.providers.emailOtp");

  while (true) {
    if (!currentUser) {
      currentUser = (await prompt(rl, "\nexternal_user_id> ")).trim();
      if (!currentUser) continue;
    }

    console.log(`\nUser: ${currentUser}`);
    if (currentEmail) console.log(`Email: ${currentEmail}`);
    console.log("  1. upsert");
    console.log("  2. enroll (send OTP)");
    console.log("  3. resend");
    console.log("  4. challenge");
    console.log("  5. verify");
    console.log("  6. status");
    console.log("  7. disable");
    console.log("  8. full flow (upsert + enroll + verify)");
    console.log("  u. change user");
    console.log("  e. change email");
    console.log("  0. exit");

    const choice = (await prompt(rl, "choice> ")).trim().toLowerCase();
    if (choice === "0" || choice === "q" || choice === "exit") break;
    if (choice === "u") {
      currentUser = (await prompt(rl, "external_user_id> ")).trim();
      continue;
    }
    if (choice === "e") {
      currentEmail = (await prompt(rl, "email> ")).trim();
      continue;
    }

    const map = {
      "1": "upsert",
      "2": "enroll",
      "3": "resend",
      "4": "challenge",
      "5": "verify",
      "6": "status",
      "7": "disable",
      "8": "flow",
    };
    const command = map[choice];
    if (!command) {
      console.log("Invalid choice");
      continue;
    }

    const flags = { user: currentUser, email: currentEmail };
    if (command === "verify") {
      flags.code = (await prompt(rl, "OTP code> ")).trim();
    }
    if (["enroll", "upsert", "flow"].includes(command) && !flags.email) {
      flags.email = (await prompt(rl, "email> ")).trim();
      currentEmail = flags.email;
    }

    try {
      await runCommand(client, command, flags);
    } catch (err) {
      const retry = err.retry_after_seconds ?? err.data?.retry_after_seconds;
      console.error(
        `Error: ${err.message}${err.code ? ` (${err.code})` : ""}${retry ? ` — retry in ${retry}s` : ""}`
      );
    }
  }

  rl.close();
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

  const client = new AuthAppClient({
    baseUrl,
    appId,
    appApiKey,
    appSecret,
    debug: process.env.AUTH_SDK_DEBUG === "true",
  });

  if (!command) {
    await interactiveLoop(client, flags.user);
    return;
  }

  if (!COMMANDS.includes(command)) {
    console.error(`Unknown command: ${command}`);
    printHelp();
    process.exit(1);
  }

  await runCommand(client, command, flags);
}

main().catch((err) => {
  console.error(
    JSON.stringify(
      {
        message: err.message,
        code: err.code,
        status: err.status,
        retry_after_seconds: err.retry_after_seconds,
      },
      null,
      2
    )
  );
  process.exit(1);
});
