# Provider Services SDK

Runtime client for Cliodot Provider Services Apps. Lives in the `cliodot` package (`packages/cliodot-sdk` / `cliodot-flosync`).

Base path: `/provider`  
Auth: `x-cliodot-app-id` + Bearer `pak_…` API key, app secret, or Identity `iak_…`.

This client always calls **this product's** HTTP: `execute`, `catalog`, `types`. There is no `cliodot.payment.charge`. Async `complete` / `getRequest` are not in this drop.

## Install

```bash
npm install cliodot
```

## Types file (required practice)

Download compile-time types for **this app's** catalog. They never drive routing or validation — Ajv still validates execute.

| Item | Detail |
|------|--------|
| Portal | `GET /api-core/cliodot/provider-apps/apps/:appId/sdk/types` |
| Runtime | `GET /provider/v1/types` (`read` scope) |
| Filename | `{slug}.provider.types.ts` |
| Response | `{ typescript, filename, export_name }` |
| Import | **Type-only**: `import type { AcmeProviders } from "./acme.provider.types"` |
| Wire-up | `new ProviderServicesClient<AcmeProviders>({ ... })` |

Unlike Gateway Surface types, generated input/output fields honor JSON Schema `required`.

```ts
import { ProviderServicesClient, isCliodotOk } from "cliodot";
import type { AcmeProviders } from "./acme.provider.types";

const provider = new ProviderServicesClient<AcmeProviders>({
  baseUrl: process.env.CLIODOT_BASE_URL!,
  appId: process.env.PROVIDER_APP_ID!,
  apiKey: process.env.PROVIDER_APP_API_KEY!,
  environment: "prod", // optional; omit to follow the project switch
});

const result = await provider.execute({
  service: "verification",
  operation: "verify",
  input: { email: "a@b.com" },
  provider: "dojah", // optional pin when routing pin_allowed
});
if (!result.ok) {
  console.error(result.error.code, result.error.message);
} else if (result.ok === true && "result" in result) {
  // domain success
}

const fluent = await provider.api.verification.verify(
  { email: "a@b.com" },
  { provider: "dojah", version: "v1" }
);
if (!fluent.ok) {
  console.error(fluent.error.code, fluent.error.message);
}

const types = await provider.downloadTypes();
if (isCliodotOk(types)) {
  // types.typescript, types.filename
}
```

`appApiKey` aliases `apiKey`. `appSecret` is also supported.

When an Identity Provider is linked, use Identity `iak_` / secret with `psv:<app_id>:execute` or `psv:<app_id>:read`. Product `pak_` and the app secret are rejected.

## Methods

| Method | HTTP |
|--------|------|
| `execute({ service, operation, input, version?, provider?, idempotency_key? })` | `POST /provider/v1/execute` |
| `api.<service>.<operation>(input, opts?)` | typed Proxy over `execute` |
| `catalog()` | `GET /provider/v1/catalog` |
| `downloadTypes()` | `GET /provider/v1/types` |

Fluent `opts` accept `version`, `provider` (pin when routing `pin_allowed`), and `idempotency_key` (API parity; ignored in phase 1).

Pin a binding with `provider` when you need a specific rail (e.g. `paystack`). Omit it to follow `default_provider` + `fallback[]`. On `PROVIDER_PIN_NOT_ALLOWED`, execute returns `{ ok: false, error: { code: "PROVIDER_PIN_NOT_ALLOWED", ... } }`.

## Errors

All SDK methods return structured results — **no try/catch required**.

- Transport/config/validation failures: `{ ok: false, error: { code, message } }`
- Execute domain failures (HTTP `502`): `{ ok: false, error, service, operation, attempts }` — inspect `attempts` for fallback details
- Success: `{ ok: true, ... }`

Use `isCliodotOk(result)` / `if (!result.ok)` at call sites. `CliodotApiError` remains exported for legacy helpers but product clients do not throw it.

## Not in this drop

`complete`, `getRequest`, and `executeAsync` are not implemented. Do not invent `cliodot.payment.*`.
