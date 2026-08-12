# Identity Apps SDK

Runtime client for Cliodot Identity Apps. Lives in the `cliodot` package (`cliodot-flosync`).

Base path: `/identity`  
Auth: `x-cliodot-app-id` + Bearer `iak_…` API key, or app secret.

**Portal vs SDK:** Create apps, trust allowlists, token policy, RS256/BYOK keys, and pipelines in the Cliodot portal. This SDK is for **runtime** authenticate / verify / refresh / revoke only.

**Identity Provider:** Event / OAuth / Auth apps (and Gateway Surface) may designate an Identity App as their Identity Provider. After linking, product `*ak_` / secrets stop working for runtime calls; callers keep the same product `appId` / gateway `slug` and present an Identity `iak_` or secret instead. See Event/OAuth/Auth guides and [SURFACE.md](./SURFACE.md).

App ids are memorable strings you choose at create time (for example `identity_hrms`, `identity_payroll`, `globus`). Secrets and `iak_` keys stay complex.

## Install

```bash
npm install cliodot
```

## Configure

```ts
import { IdentityAppClient } from "cliodot";

const identity = new IdentityAppClient({
  baseUrl: "https://your-host",
  appId: "identity_payroll",
  apiKey: process.env.IDENTITY_APP_API_KEY!,
});
```

Or with app secret:

```ts
const identity = new IdentityAppClient({
  baseUrl: "https://your-host",
  appId: "identity_payroll",
  appSecret: process.env.IDENTITY_APP_SECRET!,
});
```

`appApiKey` is accepted as an alias of `apiKey`.

## me

```ts
const me = await identity.me();
// me.app._id === "identity_payroll"
```

Maps to `GET /identity/v1/me`.

## Authenticate

Prefer `provider()` for internal Cliodot Identity Apps and `extProvider()` for External Application Profiles. Low-level `authenticate({ target_app_id })` remains available.

### Internal Identity Apps — `provider()`

```ts
const hrms = identity.provider("identity_hrms");
const tokens = await hrms.authenticate();
await hrms.verify(tokens.access_token);
await hrms.refresh(tokens.refresh_token!);
```

`provider()` never resolves External Profiles (`ext:` / `ext_`).

### External Application Profiles — `extProvider()`

```ts
const hrms = identity.extProvider("hrms");
const tokens = await hrms.authenticate();
await hrms.verify(tokens.access_token);
await hrms.refresh(tokens.refresh_token!);
```

Maps to `target_app_id: "ext:hrms"`. `extProvider()` never resolves Identity Apps.

### Low-level authenticate

Caller app authenticates to a trusted target. Target must allowlist the caller in the portal (same-tenant direct trust, or cross-tenant trust invite accepted by the caller tenant). JWT `tid` is always the **target** tenant for internal apps; external targets use the **host** Identity App for trust.

```ts
const tokens = await identity.authenticate({
  target_app_id: "identity_hrms",
});

console.log(tokens.access_token);
console.log(tokens.refresh_token);
console.log(tokens.expires_in);
```

When the target has scopes enabled (`identity_apps_scopes_enabled` + portal catalog):

```ts
const tokens = await identity.authenticate({
  target_app_id: "identity_hrms",
  scopes: ["employees.read"],
});
```

Issuance (when scopes are enabled on the target):

- Omit `scopes` → receive the full trust grant (empty grant = entire catalog)
- Pass `scopes` → receive only that subset (must be within the grant)

Access JWTs include a `scope` claim as a **string array** when non-empty.

Maps to `POST /identity/v1/authenticate` → access JWT (+ optional refresh).

## Verify (online)

Cliodot re-checks signature, expiry, revocation, and trust:

```ts
const verified = await identity.verify({
  access_token: tokens.access_token,
});

const bound = await identity.verify({
  access_token: tokens.access_token,
  target_app_id: "identity_hrms",
});

const scoped = await identity.verify({
  access_token: tokens.access_token,
  required_scopes: ["employees.read"],
});
```

`required_scopes` requires the scopes license; missing scopes → `IDENTITY_SCOPE_INSUFFICIENT`.
Maps to `POST /identity/v1/verify` or `POST /identity/v1/apps/:appId/verify`.

## Refresh / revoke

```ts
const rotated = await identity.refresh({
  refresh_token: tokens.refresh_token!,
});

await identity.revoke({
  refresh_token: tokens.refresh_token,
});
```

Maps to `POST /identity/v1/token/refresh` and `POST /identity/v1/token/revoke`.

## JWKS

Unauthenticated public keys for RS256 targets (requires RS256 license on the platform):

```ts
const jwks = await identity.getJwks("identity_hrms");
```

Maps to `GET /identity/v1/apps/:appId/jwks.json`.

## Offline verify

Offline checks cryptography and `exp` only — not trust or revocation. Prefer online `verify()` when those matter.

### HS256

```ts
import { verifyIdentityTokenOffline } from "cliodot";

const claims = await verifyIdentityTokenOffline(tokens.access_token, {
  algorithm: "HS256",
  secret: process.env.HRMS_JWT_VERIFY_SECRET!,
});
```

### RS256 (JWKS)

```ts
const claims = await verifyIdentityTokenOffline(tokens.access_token, {
  algorithm: "RS256",
  jwksUrl: "https://your-host/identity/v1/apps/identity_hrms/jwks.json",
});
```

Or pass `publicKeyPem` directly. JWKS responses are cached (default 5 minutes); a missing `kid` triggers one refresh.

### Scope checks offline

```ts
import { tokenHasScopes, parseIdentityScopeClaim } from "cliodot";

const ok = tokenHasScopes(tokens.access_token, ["employees.read"]);
const scopes = parseIdentityScopeClaim(claims);
```

Offline scope checks are local only; they do not re-check trust or Cliodot grants.

## Token cache helper

```ts
import { createIdentityTokenCache } from "cliodot";

const cache = createIdentityTokenCache({ client: identity });
const accessToken = await cache.getAccessToken("identity_hrms");
```

Authenticates on miss; refreshes when a refresh token is available; clears near expiry with a skew window.

## Errors

Failures surface as `CliodotApiError` with `code`, `status`, and `message`. Common Identity codes:

| Code | Meaning |
|------|---------|
| `IDENTITY_TRUST_DENIED` | Target does not trust caller |
| `IDENTITY_TOKEN_INVALID` | Bad access token |
| `IDENTITY_TOKEN_EXPIRED` | Access expired |
| `IDENTITY_TOKEN_REVOKED` | Access revoked |
| `IDENTITY_REFRESH_REVOKED` | Refresh reuse / revoked |
| `IDENTITY_FEATURE_NOT_LICENSED` | Advanced feature (e.g. JWKS, scopes) not on license |
| `IDENTITY_SCOPE_DENIED` | Requested / stored scopes not granted |
| `IDENTITY_SCOPE_INSUFFICIENT` | Online verify missing required_scopes |
| `IDENTITY_SCOPE_INVALID` | Bad scope name / not in catalog |
| `FEATURE_NOT_LICENSED` | Middleware license gate |

## HTTP reference

| Op | Method | Path | Auth |
|----|--------|------|------|
| Me | GET | `/identity/v1/me` | App |
| Authenticate | POST | `/identity/v1/authenticate` | App |
| Verify | POST | `/identity/v1/verify` | App |
| Verify bound | POST | `/identity/v1/apps/:appId/verify` | App |
| Refresh | POST | `/identity/v1/token/refresh` | App |
| Revoke | POST | `/identity/v1/token/revoke` | App |
| JWKS | GET | `/identity/v1/apps/:appId/jwks.json` | None |
