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
  "verify-public",
  "status",
  "disable",
  "flow",
];

function printHelp() {
  console.log(`
Auth App Magic Link CLI (SDK) — uses client.providers.magicLink from the cliodot package.

Usage:
  npm run auth-app-magic-link-sdk -- <appId> <command> [options]
  npm run auth-app-magic-link-sdk -- <appId>                    # interactive menu

Commands:
  upsert         client.users.upsert (set email/phone on user record)
  enroll         client.providers.magicLink.enroll (send first link)
  resend         client.providers.magicLink.resend
  challenge      client.providers.magicLink.challenge
  verify         client.providers.magicLink.verify (S2S, requires --user)
  verify-public  client.providers.magicLink.verifyPublic (token only, no app secret)
  status         client.providers.magicLink.status
  disable        client.providers.magicLink.disable
  flow           upsert + enroll + prompt for token + verify (end-to-end test)

Options:
  --user <id>              external_user_id (required for S2S commands except verify-public)
  --email <email>          recipient email (email delivery template)
  --phone <phone>          recipient phone (sms delivery template)
  --phone-country <code>   phone_country_code
  --token <token>          magic link token (or full URL with ?token=)
  --subject <text>         custom_subject override on send
  --body <text>            custom_body override on send
  --cc <email>             optional CC on send
  --app-id <id>            auth app _id (alternative to first positional arg)
  --public                 use verify-public in flow command

Env vars:
  CLIODOT_BASE_URL           Public API origin (default: http://localhost:8901)
  AUTH_APP_ID                Auth app _id
  AUTH_APP_API_KEY           aak_... (preferred for S2S commands)
  AUTH_APP_SECRET            app secret (alternative)
  AUTH_MAGIC_LINK_USER       default external_user_id
  AUTH_MAGIC_LINK_EMAIL      default recipient email
  AUTH_MAGIC_LINK_PHONE      default recipient phone

Prerequisites:
  1. Auth app has magic_link enabled with delivery + content configured
  2. cd cliodot-flosync && npm run build

Examples:
  npm run auth-app-magic-link-sdk -- auth_app_xxx upsert --user user_123 --email you@example.com
  npm run auth-app-magic-link-sdk -- auth_app_xxx enroll --user user_123 --email you@example.com
  npm run auth-app-magic-link-sdk -- auth_app_xxx verify --user user_123 --token <token>
  npm run auth-app-magic-link-sdk -- auth_app_xxx verify-public --token <token>
  npm run auth-app-magic-link-sdk -- auth_app_xxx flow --user user_123 --email you@example.com
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

function normalizeToken(raw) {
  const value = String(raw || "").trim();
  if (!value) return value;
  try {
    const url = new URL(value);
    const fromQuery = url.searchParams.get("token");
    if (fromQuery) return fromQuery;
  } catch {
  }
  return value;
}

function buildSendInput(flags) {
  const input = {};
  if (flags.email) input.email = flags.email;
  if (flags.phone) input.phone = flags.phone;
  if (flags["phone-country"]) input.phone_country_code = flags["phone-country"];
  if (flags.subject) input.custom_subject = flags.subject;
  if (flags.body) input.custom_body = flags.body;
  if (flags.cc) input.cc = flags.cc;
  return Object.keys(input).length ? input : undefined;
}

function printSendResult(result) {
  if (result.sent) {
    console.log(
      `Magic link sent. Expires in: ${result.expires_in ?? "unknown"}s` +
        (result.challenge_id ? ` (challenge: ${result.challenge_id})` : "")
    );
  }
  console.log(JSON.stringify(result, null, 2));
}

async function runCommand(client, command, flags) {
  const user = flags.user || process.env.AUTH_MAGIC_LINK_USER;
  const email = flags.email || process.env.AUTH_MAGIC_LINK_EMAIL;
  const phone = flags.phone || process.env.AUTH_MAGIC_LINK_PHONE;
  const sendInput = buildSendInput({ ...flags, email: flags.email || email, phone: flags.phone || phone });

  switch (command) {
    case "upsert": {
      if (!user) throw new Error("--user is required for upsert");
      if (!email && !phone) throw new Error("--email or --phone is required for upsert");
      const result = await client.users.upsert(user, {
        email,
        phone,
        phone_country_code: flags["phone-country"],
      });
      console.log(JSON.stringify(result, null, 2));
      return;
    }
    case "enroll": {
      if (!user) throw new Error("--user is required for enroll");
      if (!sendInput?.email && !sendInput?.phone) {
        throw new Error("--email or --phone is required for enroll");
      }
      const result = await client.providers.magicLink.enroll(user, sendInput);
      printSendResult(result);
      return;
    }
    case "resend": {
      if (!user) throw new Error("--user is required for resend");
      const result = await client.providers.magicLink.resend(user, sendInput);
      printSendResult(result);
      return;
    }
    case "challenge": {
      if (!user) throw new Error("--user is required for challenge");
      const result = await client.providers.magicLink.challenge(user, sendInput);
      printSendResult(result);
      return;
    }
    case "verify": {
      if (!user) throw new Error("--user is required for verify");
      if (!flags.token) throw new Error("--token is required for verify");
      const token = normalizeToken(flags.token);
      const result = await client.providers.magicLink.verify(user, token);
      console.log(
        result.verified
          ? `Verified (${result.method}, user: ${result.user_reference})`
          : "Verification failed"
      );
      console.log(JSON.stringify(result, null, 2));
      return;
    }
    case "verify-public": {
      if (!flags.token) throw new Error("--token is required for verify-public");
      const token = normalizeToken(flags.token);
      const result = await client.providers.magicLink.verifyPublic(token);
      console.log(
        result.verified
          ? `Verified (${result.method}, user: ${result.user_reference})`
          : "Verification failed"
      );
      console.log(JSON.stringify(result, null, 2));
      return;
    }
    case "status": {
      if (!user) throw new Error("--user is required for status");
      const result = await client.providers.magicLink.status(user);
      console.log(JSON.stringify(result, null, 2));
      return;
    }
    case "disable": {
      if (!user) throw new Error("--user is required for disable");
      const result = await client.providers.magicLink.disable(user);
      console.log(JSON.stringify(result, null, 2));
      return;
    }
    case "flow": {
      if (!user) throw new Error("--user is required for flow");
      if (!email && !phone) throw new Error("--email or --phone is required for flow");
      console.log("\n1/3 Upsert user...");
      await client.users.upsert(user, {
        email,
        phone,
        phone_country_code: flags["phone-country"],
      });
      console.log("2/3 Enroll + send magic link...");
      const enroll = await client.providers.magicLink.enroll(user, sendInput);
      printSendResult(enroll);
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
      const tokenRaw = await new Promise((resolve) => {
        rl.question("\nPaste magic link URL or token> ", (answer) => {
          rl.close();
          resolve(answer.trim());
        });
      });
      const token = normalizeToken(tokenRaw);
      if (!token) throw new Error("Token is required");
      console.log("3/3 Verify...");
      const verify = flags.public
        ? await client.providers.magicLink.verifyPublic(token)
        : await client.providers.magicLink.verify(user, token);
      console.log(
        verify.verified
          ? `\nSuccess — magic link verified for ${verify.user_reference || user}`
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
  let currentUser = defaultUser || process.env.AUTH_MAGIC_LINK_USER || "";
  let currentEmail = process.env.AUTH_MAGIC_LINK_EMAIL || "";
  let currentPhone = process.env.AUTH_MAGIC_LINK_PHONE || "";

  console.log("\nAuth App Magic Link (SDK) — interactive mode");
  console.log("Client: AuthAppClient.providers.magicLink");

  while (true) {
    if (!currentUser) {
      currentUser = (await prompt(rl, "\nexternal_user_id> ")).trim();
      if (!currentUser) continue;
    }

    console.log(`\nUser: ${currentUser}`);
    if (currentEmail) console.log(`Email: ${currentEmail}`);
    if (currentPhone) console.log(`Phone: ${currentPhone}`);
    console.log("  1. upsert");
    console.log("  2. enroll (send link)");
    console.log("  3. resend");
    console.log("  4. challenge");
    console.log("  5. verify (S2S)");
    console.log("  6. verify-public");
    console.log("  7. status");
    console.log("  8. disable");
    console.log("  9. full flow (upsert + enroll + verify)");
    console.log("  u. change user");
    console.log("  e. change email");
    console.log("  p. change phone");
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
    if (choice === "p") {
      currentPhone = (await prompt(rl, "phone> ")).trim();
      continue;
    }

    const map = {
      "1": "upsert",
      "2": "enroll",
      "3": "resend",
      "4": "challenge",
      "5": "verify",
      "6": "verify-public",
      "7": "status",
      "8": "disable",
      "9": "flow",
    };
    const command = map[choice];
    if (!command) {
      console.log("Invalid choice");
      continue;
    }

    const flags = { user: currentUser, email: currentEmail, phone: currentPhone };
    if (["verify", "verify-public"].includes(command)) {
      flags.token = (await prompt(rl, "magic link URL or token> ")).trim();
    }
    if (["enroll", "upsert", "flow"].includes(command) && !flags.email && !flags.phone) {
      flags.email = (await prompt(rl, "email (or leave blank for phone)> ")).trim() || undefined;
      if (!flags.email) {
        flags.phone = (await prompt(rl, "phone> ")).trim() || undefined;
        currentPhone = flags.phone || currentPhone;
      } else {
        currentEmail = flags.email;
      }
    }
    if (command === "flow") {
      const mode = (await prompt(rl, "verify mode: [s2s]/public> ")).trim().toLowerCase();
      if (mode === "public") flags.public = true;
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

  if (!command || command !== "verify-public") {
    if (!appApiKey && !appSecret) {
      console.error("Set AUTH_APP_API_KEY or AUTH_APP_SECRET for S2S commands.");
      process.exit(1);
    }
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
