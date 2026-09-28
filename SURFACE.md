# Gateway Surface (`Surface`)

Call a Cliodot **connector gateway** as a fluent TypeScript client — without generating a custom HTTP SDK per gateway.

```ts
import { Surface, CliodotApiError } from "cliodot";
import type { CustomerManagement } from "./payment.surface.types";

const api = new Surface<CustomerManagement>({
  baseUrl: "https://flash.example.com",
  slug: "payment",
  apiKey: process.env.GATEWAY_API_KEY,
  environment: "dev", // optional; omit to follow the project switch
});
```

When the gateway has **SDK Identity Provider** set (`sdk.identity.provider`), use an Identity `iak_` (or Identity app secret) instead of the gateway `gw_…` key — same `Surface` shape:

```ts
const api = new Surface<CustomerManagement>({
  baseUrl: "https://flash.example.com",
  slug: "payment",
  apiKey: process.env.IDENTITY_IAK,
});
```

Plain HTTP callers (no Surface / no `X-Cliodot-Client: sdk`) still use gateway auth (`none` / `api_key` / `jwt`) and ignore `sdk.identity.provider`.

const balance = await api.ledger.balance({
  from: "2026-01-01",
  to: "2026-01-31",
});

await api.charge.create({
  email: "a@b.com",
  amount: "1000",
  type: "card",
});
```

---

## What Surface is

A **gateway** publishes ordinary HTTP routes (`GET /ledger/balance`, `POST /charge`, …).

**Surface** is the SDK side of that gateway:

1. The gateway owner marks which routes are **exposed to the SDK** and names them as fluent paths (`ledger.balance`, `charge.create`).
2. At runtime, `new Surface(...)` loads that catalog from `GET /sdk/surface`.
3. Calls like `api.ledger.balance(query)` are turned into the matching gateway HTTP request, with SDK attestation headers.

Surface is **not**:

- A generated client package per gateway
- A replacement for `FlosyncClient` / workflow `runConnector`
- A runtime validator for body/query shapes (types are compile-time only)

```text
Gateway portal: expose POST /charge as charge.create
        ↓
Surface catalog (ops list) at GET …/sdk/surface
        ↓
new Surface() → api.charge.create(body?)
        ↓
Same public gateway URL + auth + SDK attestation
```

---

## What you need from the gateway

| Requirement | Notes |
|-------------|--------|
| Gateway **SDK enabled** | `sdk.enabled` on the gateway |
| Endpoints **exposed** | `sdk.expose` + fluent `path` / `op` (and `arg_names` for path params) |
| Public base URL | Host that serves the gateway (custom domain or gateway host) |
| Auth | Same credentials as HTTP: API key (`gw_…`) and/or JWT, depending on gateway auth |

Types file (optional but recommended): download from the portal / `GET /gateways/:id/sdk/types` (e.g. `payment.surface.types.ts`) and pass it as the generic:

```ts
new Surface<CustomerManagement>({ ... })
```

Without the generic, calls still work; you just lose autocomplete and argument typing.

---

## Install

```bash
npm install cliodot
# or
yarn add cliodot
```

```ts
import { Surface, CliodotApiError } from "cliodot";
```

(`@cliodot/flosync` is the same package when linked locally from this repo.)

---

## Configuration

```ts
new Surface<T>({
  baseUrl: string;       // required — gateway origin, no trailing slash needed
  slug?: string;         // gateway slug; paths become {baseUrl}/{slug}/…
  apiKey?: string;       // gateway API key (gw_…)
  jwt?: string;          // Bearer token when gateway uses JWT
  apiKeyHeader?: string; // default "X-API-Key"
  version?: string;      // SDK version sent in attestation (defaults to package version)
  fetchSurface?: boolean;// reserved; surface loads lazily on first call
});
```

### `baseUrl` + `slug`

| Setup | Example |
|-------|---------|
| Custom / flash domain | `baseUrl: "https://flash.example.com"`, `slug: "payment"` → invokes `https://flash.example.com/payment/...` |
| Local domain routing | `baseUrl: "http://flash.localhost:8901"`, `slug: "payment"` |

Surface loads the catalog from `{baseUrl}/{slug}/sdk/surface` (or `{baseUrl}/sdk/surface` if `slug` is omitted and the host already scopes the gateway).

Use the **gateway API key** from generate-key (returned once as `gw_…`). That key authenticates the request and signs SDK attestation.

When **SDK Identity Provider** is designated on the gateway, Surface must use an Identity `iak_` / secret instead. Gateway `gw_…` keys and gateway JWTs are rejected on the SDK path. HTTP-only callers are unchanged.


---

## Fluent calls

Exposed ops appear as nested properties ending in a method:

| Fluent id | Call |
|-----------|------|
| `ledger.balance` | `api.ledger.balance(query?)` |
| `charge.create` | `api.charge.create(body?)` |
| `customers.cards.list` | `api.customers.cards.list(customerId, query?)` |

### Argument order

```text
(...pathArgs, body?, query?)
```

- **Path args** — one string per URL param (`{id}`, `:id`, …), in `arg_names` order. Required at runtime.
- **Body** — object for POST/PUT/PATCH when the op accepts a body. Optional in generated types.
- **Query** — object for query string params. Optional.

Examples:

```ts
await api.users.account();
await api.users.create({ email: "a@b.com" });
await api.users.retrieve("usr_123");
await api.users.update("usr_123", { name: "Ada" });
await api.customers.cards.list("cust_123", { limit: "10" });
```

Input fields on generated body/query interfaces are **all optional** (`field?: …`). The gateway / connector still enforces what is actually required.

---

## Typed surface file

Download or copy types from the gateway:

`GET /gateways/:gatewayId/sdk/types` → `{ typescript, filename, export_name }`

Example shape:

```ts
export interface ChargeCreateBody {
  email?: string;
  amount?: string;
  type?: string;
}

export interface CustomerManagement {
  charge: {
    create(body?: ChargeCreateBody): Promise<unknown>;
  };
  ledger: {
    balance(query?: LedgerBalanceQuery): Promise<unknown>;
  };
}
```

Schemas are resolved in this order for each op:

1. Gateway mapper `input_schema` (body / query)
2. Mapper mapping rules
3. Connector (or workflow trigger) request schema

Use the file as a type-only import; do not instantiate it.

```ts
import type { CustomerManagement } from "./payment.surface.types";
```

Regenerate the file when you expose new ops or connector schemas change.

---

## Runtime behavior

1. **Lazy catalog** — first method call (or `api.loadSurface()`) fetches `GET /sdk/surface` with attestation.
2. **Op lookup** — fluent path + method name must match an exposed op; otherwise `SDK_OP_NOT_EXPOSED`.
3. **Invoke** — builds the gateway path, attaches auth + attestation, sends the HTTP request.
4. **Response** — returns `data` from the gateway envelope when present, otherwise the raw JSON body.

```ts
const catalog = await api.loadSurface();
const catalogAgain = await api.loadSurface(true);
```

---

## Auth and attestation

Every Surface request (catalog + invoke) sends:

| Header | Purpose |
|--------|---------|
| `X-API-Key` / `Authorization` | Gateway auth (when configured) |
| `X-Cliodot-Client: sdk` | Marks the call as SDK channel |
| `X-Cliodot-SDK-Version` | Client version |
| `X-Cliodot-SDK-Timestamp` | Unix ms |
| `X-Cliodot-SDK-Nonce` | Random nonce |
| `X-Cliodot-SDK-Signature` | HMAC-SHA256 of the canonical request |

Signing secret is the API key (or JWT if that is what you configured). Plain HTTP clients without these headers use the **HTTP** channel; Surface uses the **SDK** channel. Those are independent: an endpoint can be SDK-only, HTTP-only, both, or neither.

---

## Errors

Failures throw `CliodotApiError`:

```ts
import { Surface, CliodotApiError } from "cliodot";

try {
  await api.charge.create({ email: "a@b.com" });
} catch (error) {
  if (error instanceof CliodotApiError) {
    console.error(error.message, error.status, error.code, error.data);
  }
}
```

Common codes:

| Code | Meaning |
|------|---------|
| `SURFACE_LOAD_FAILED` | Could not load `/sdk/surface` |
| `SDK_OP_NOT_EXPOSED` | Fluent path is not in the catalog |
| `SURFACE_REQUEST_FAILED` | Gateway returned an error status / `ok: false` |

---

## Surface vs typed connectors vs FlosyncClient

| | **Surface** | **Typed connector** | **FlosyncClient** |
|--|-------------|---------------------|-------------------|
| Audience | App calling a **published gateway** | Workflows / local connector contracts | Platform API (manage connectors, run remotely, etc.) |
| Entry | `new Surface()` | `defineTypedConnector` + workflow steps | `new FlosyncClient()` |
| Routing | Gateway fluent ops → public HTTP | Connector id + action inside Flowsync | REST against Cliodot API |
| Types | `*.surface.types.ts` from gateway | `defineTypedConnector` schemas | Client method typings |

Use Surface when you are integrating **as a consumer of a gateway**. Use typed connectors when you author workflows against connectors directly.

---

## Minimal end-to-end

1. In the portal: enable gateway SDK, expose endpoints (`charge.create`, …), generate an API key.
2. Download types → save as `payment.surface.types.ts`.
3. In your app:

```ts
import { Surface, CliodotApiError } from "cliodot";
import type { CustomerManagement } from "./payment.surface.types";

const api = new Surface<CustomerManagement>({
  baseUrl: process.env.GATEWAY_BASE_URL!,
  slug: "payment",
  apiKey: process.env.GATEWAY_API_KEY!,
});

async function main() {
  try {
    const result = await api.ledger.balance({
      from: "2026-01-01",
      to: "2026-01-31",
      perPage: "10",
      page: "1",
    });
    console.log(result);
  } catch (error) {
    console.error((error as CliodotApiError).message);
  }
}

main();
```

---

## Related

- How Surface is wired (Proxy, catalog, attestation, server gates): [SURFACE_INTERNALS.md](./SURFACE_INTERNALS.md)
- Portal / frontend mapping guide (gateway repo): `GATEWAY_SDK_SURFACE_FRONTEND_GUIDE.md`
- Typed connectors (workflows): [TYPED_CONNECTOR_EXAMPLES.md](./TYPED_CONNECTOR_EXAMPLES.md)
