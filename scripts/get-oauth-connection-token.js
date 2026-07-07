#!/usr/bin/env node
const path = require("path");
const fs = require("fs");

const rootEnv = path.resolve(__dirname, "../../.env");
if (fs.existsSync(rootEnv)) {
  try {
    require("dotenv").config({ path: rootEnv });
  } catch {
    // dotenv optional when run from monorepo root with -r dotenv/config
  }
}

let OAuthAppClient;
try {
  ({ OAuthAppClient } = require("../dist"));
} catch {
  console.error("SDK not built. Run: npm run build");
  process.exit(1);
}

function printHelp() {
  console.log(`
Usage: node scripts/get-oauth-connection-token.js <connectionId>

Fetches the access token for an OAuth connection via the Cliodot SDK.
Refreshes automatically if the token is expired.

Env vars:
  CLIODOT_BASE_URL     API origin (default: http://localhost:8901)
  OAUTH_APP_ID         OAuth app _id (e.g. oauth_app_...)
  OAUTH_APP_API_KEY    App API key (oak_...) — use this or OAUTH_APP_SECRET
  OAUTH_APP_SECRET     App secret — alternative to OAUTH_APP_API_KEY

Examples:
  npm run get-oauth-connection-token -- conn_abc123
  OAUTH_APP_ID=oauth_app_xxx OAUTH_APP_API_KEY=oak_xxx node scripts/get-oauth-connection-token.js conn_abc123

Prerequisite: npm run build
`);
}

async function main() {
  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    printHelp();
    process.exit(0);
  }

  const connectionId = process.argv[2] || process.env.OAUTH_CONNECTION_ID;
  const baseUrl = process.env.CLIODOT_BASE_URL || process.env.OAUTH_APP_BASE_URL || "http://localhost:8901";
  const appId = "oauth_app_6a4cf7190d6fcdb53e5055e7";
  const appApiKey = "oak_ff31a1d227ffad220199bb62124cd17ef8e956bd14ebff55";
  const appSecret = "f4e4894b3819248e8e8ea6a198ff6f98889e5cf7070672094af3b9af42435a0c";

  if (!connectionId) {
    console.error("Missing connectionId. Pass as first argument or set OAUTH_CONNECTION_ID.");
    printHelp();
    process.exit(1);
  }

  if (!appId) {
    console.error("Missing OAUTH_APP_ID.");
    process.exit(1);
  }

  if (!appApiKey && !appSecret) {
    console.error("Set OAUTH_APP_API_KEY or OAUTH_APP_SECRET.");
    process.exit(1);
  }

  const client = new OAuthAppClient({
    baseUrl,
    appId,
    appApiKey,
    appSecret,
  });

  const result = await client.connections.getToken(connectionId);

  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error(
    JSON.stringify(
      {
        message: err?.message || "Request failed",
        status: err?.status,
        code: err?.code,
      },
      null,
      2
    )
  );
  process.exit(1);
});
