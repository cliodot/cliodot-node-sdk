/**
 * Identity Apps runtime example.
 *
 * Requires env:
 *   CLIODOT_BASE_URL
 *   IDENTITY_CALLER_APP_ID   e.g. identity_payroll
 *   IDENTITY_CALLER_API_KEY  iak_...
 *   IDENTITY_TARGET_APP_ID   e.g. identity_hrms
 *
 * Run: node -r dotenv/config examples/identity-authenticate.js
 */
const {
  IdentityAppClient,
  createIdentityTokenCache,
} = require("../dist");

async function main() {
  const baseUrl = process.env.CLIODOT_BASE_URL;
  const appId = process.env.IDENTITY_CALLER_APP_ID;
  const apiKey = process.env.IDENTITY_CALLER_API_KEY;
  const targetAppId = process.env.IDENTITY_TARGET_APP_ID || "identity_hrms";

  if (!baseUrl || !appId || !apiKey) {
    throw new Error(
      "Set CLIODOT_BASE_URL, IDENTITY_CALLER_APP_ID, IDENTITY_CALLER_API_KEY"
    );
  }

  const identity = new IdentityAppClient({ baseUrl, appId, apiKey });
  const me = await identity.me();
  console.log("me", me.app._id);

  const tokens = await identity.authenticate({ target_app_id: targetAppId });
  console.log("authenticated", {
    target: tokens.target_app_id,
    expires_in: tokens.expires_in,
  });

  const verified = await identity.verify({
    access_token: tokens.access_token,
    target_app_id: targetAppId,
  });
  console.log("verified", verified.jti);

  if (tokens.refresh_token) {
    const refreshed = await identity.refresh({
      refresh_token: tokens.refresh_token,
    });
    console.log("refreshed", refreshed.expires_in);
  }

  const cache = createIdentityTokenCache({ client: identity });
  const cached = await cache.getAccessToken(targetAppId);
  console.log("cached token length", cached.length);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
