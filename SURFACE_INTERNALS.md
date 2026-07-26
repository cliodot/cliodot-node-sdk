# How Surface Works (Internals)

This document explains the “magic” behind `api.ledger.balance(...)` — how a fluent property chain becomes a signed HTTP call into a connector gateway, and how the server is wired to accept it.

For usage, see [SURFACE.md](./SURFACE.md).

---

## The illusion

You write:

```ts
const api = new Surface<CustomerManagement>({ baseUrl, slug, apiKey });
await api.ledger.balance({ from: "2026-01-01" });
```

There is **no** generated `ledger` class, **no** per-method HTTP wrapper, and **no** code emitted into the SDK for your gateway.

At runtime you only have:

1. A **Proxy** that records property access (`ledger` → `balance`)
2. A **surface catalog** fetched once from the gateway (`GET /sdk/surface`)
3. A normal **HTTP request** built from the matching catalog op
4. **Attestation headers** so the server treats the call as the SDK channel

Types (`*.surface.types.ts`) are compile-time only. They never drive routing.

---

## End-to-end wiring

```text
┌─────────────────────────────────────────────────────────────────┐
│  App                                                            │
│  new Surface(config)  →  Proxy root                             │
│  api.ledger.balance(q)                                          │
│       │                                                         │
│       │ 1) Proxy builds path ["ledger","balance"]               │
│       │ 2) loadSurface() → GET {base}/{slug}/sdk/surface        │
│       │ 3) find op sdk_path=["ledger"] op="balance"             │
│       │ 4) map args → pathParams / body / query                 │
│       │ 5) HTTP {method} {base}/{slug}{endpoint_path}           │
│       │    + auth + X-Cliodot-SDK-* attestation                 │
└───────┼─────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────────┐
│  Gateway host (domain or /gateway/:slug)                        │
│                                                                 │
│  GET  /:slug/sdk/surface     → catalog (ops + schemas)          │
│  *    /:slug/:endpoint_path  → execute endpoint                 │
│                                                                 │
│  On invoke:                                                     │
│    auth (API key / JWT)                                         │
│    → verifySdkAttestation → channel = "sdk" | "http"            │
│    → endpointAllowsChannel (enabled vs sdk.expose)              │
│    → mapper → connector / workflow execution                    │
│    → JSON response                                              │
└─────────────────────────────────────────────────────────────────┘
```

---

## Client: constructor trick

```ts
export const Surface = function Surface(config) {
  const runtime = new SurfaceRuntime(config);
  return runtime.asProxy();
} as unknown as SurfaceConstructor;
```

`new Surface(...)` does **not** return an instance of a class with methods. It returns a **Proxy** backed by a private `SurfaceRuntime`.

TypeScript still types the return value as `SurfaceClient<TSurface>` (your interface ∩ `{ loadSurface }`) because of the construct signature cast. That is how `api.ledger.balance` type-checks even though those properties do not exist on a real object.

---

## Client: the Proxy “fluent recorder”

`asProxy(path)` returns a Proxy around a callable function.

| Access | What happens |
|--------|----------------|
| `api.ledger` | `get` → `asProxy(["ledger"])` |
| `api.ledger.balance` | `get` → `asProxy(["ledger","balance"])` |
| `api.ledger.balance(query)` | `apply` → `invoke(["ledger"], "balance", [query])` |

Special cases on `get`:

- `then` → `undefined` (so the proxy is not treated as a thenable / Promise)
- `loadSurface` → bound to the runtime helper
- symbols → ignored

So the fluent API is just **accumulating string segments until something is called**. Nested resources work the same way:

```text
api.customers.cards.list(id, query)
  → path segments ["customers","cards","list"]
  → sdkPath = ["customers","cards"], op = "list"
```

There is no tree built ahead of time from the catalog. Wrong paths fail later in `findOp`, not when you touch the property.

---

## Client: surface catalog

On first invoke (or `loadSurface()`):

```text
GET {invokeBaseUrl}/sdk/surface
Headers: auth + attestation (method=GET, path=/sdk/surface, empty body)
```

`invokeBaseUrl` is `{baseUrl}/{slug}` when `slug` is set.

Response (simplified):

```json
{
  "ok": true,
  "surface": {
    "version": 1,
    "gateway": { "slug": "payment", "sdk_enabled": true, "client_name": "CustomerManagement" },
    "ops": [
      {
        "id": "ledger.balance",
        "sdk_path": ["ledger"],
        "op": "balance",
        "method": "GET",
        "endpoint_path": "/ledger/balance",
        "path_params": [],
        "query_schema": { "from": "string", "to": "string" },
        "body": false,
        "body_schema": null
      },
      {
        "id": "charge.create",
        "sdk_path": ["charge"],
        "op": "create",
        "method": "POST",
        "endpoint_path": "/charge",
        "path_params": [],
        "body": true,
        "body_schema": { "email": "…", "amount": "…" },
        "query_schema": null
      }
    ]
  }
}
```

The catalog is cached on the runtime. `loadSurface(true)` forces a refetch.

`body_schema` / `query_schema` on the catalog are informational for tooling; the client does **not** validate them. They mainly feed the separate **types** artifact.

---

## Client: invoke pipeline

`invoke(sdkPath, opName, args)`:

1. **Ensure catalog** — `loadSurface()`
2. **Resolve op** — find catalog entry where `sdk_path` + `op` match exactly
3. **Peel args in order**
   - For each `path_params` name → next arg (required)
   - If `op.body` → next arg (may be `undefined`)
   - If `op.query_schema` → next arg (query object)
4. **Fill URL** — replace `:id` / `{id}` / `{{id}}` in `endpoint_path`
5. **Sign** — attestation over `method + endpointPath + body` (body omitted from hash when not sent)
6. **HTTP** — `axios.request` to `{invokeBaseUrl}{endpointPath}`
7. **Unwrap** — return `response.data.data` if present, else `response.data`

Content-Type is set only when a body is actually sent. That avoids Express turning empty GETs into `body: {}` and breaking the body hash on the server.

---

## Client: attestation (why it is not “just HTTP”)

Every Surface request includes:

```text
X-Cliodot-Client: sdk
X-Cliodot-SDK-Version: …
X-Cliodot-SDK-Timestamp: <ms>
X-Cliodot-SDK-Nonce: <hex>
X-Cliodot-SDK-Signature: HMAC-SHA256(secret, canonical)
```

Canonical string:

```text
{timestamp}.{nonce}.{METHOD}.{path}.{sha256(bodyRaw)}
```

- `path` is the gateway path only (e.g. `/ledger/balance` or `/sdk/surface`), not the full URL
- Empty / missing body → hash of `""`
- Secret = API key, else JWT, else `sdk:{slug}`

The server recomputes the same HMAC. If `X-Cliodot-Client` is absent, the call is treated as plain **http** channel (no attestation required).

---

## Server: where Surface is wired

| Piece | Location (gateway API) | Role |
|-------|------------------------|------|
| Fluent metadata on endpoints | `endpoint.sdk.{expose,path,op,arg_names}` | Names the op in the catalog |
| Gateway master switch | `gateway.sdk.{enabled,client_name}` | Empty ops / reject SDK if off |
| Build catalog | `gateway.sdk.surface.ts` → `buildGatewaySdkSurface` | Ops list for clients |
| Enrich schemas | `GatewayService.buildEnrichedSdkSurface` | Mapper → mapping → connector/workflow body & query |
| Types artifact | `buildGatewaySdkTypesArtifact` | `*.surface.types.ts` string |
| Management APIs | `GET /gateways/:id/sdk/surface`, `…/sdk/types` | Portal download / preview |
| Public catalog | `GET /:slug/sdk/surface` (domain + public routers) | What `Surface.loadSurface` hits |
| Suggest mapping | `POST …/endpoints/:id/sdk/suggest` | Auto `path` / `op` / `arg_names` |
| Dual channel gate | `endpointAllowsChannel` in `gateway.sdk.util.ts` | HTTP `enabled` vs SDK `expose` |
| Attestation verify | `verifySdkAttestation` on invoke + public surface | Channel detection + HMAC |
| Execute | Existing gateway execution path | Mapper → connector / workflow |

Surface does **not** add a parallel execution engine. It reuses the same public invoke path as curl/Postman; attestation + channel gates are the only SDK-specific layers.

---

## Server: dual channels

```text
                    ┌── channel "http"  → requires endpoint.enabled
Request ──auth──►   │
                    └── channel "sdk"   → requires gateway.sdk.enabled
                                         + endpoint.sdk.expose
```

| HTTP `enabled` | SDK `expose` | curl / browser | `Surface` |
|----------------|--------------|----------------|-----------|
| on | on | yes | yes |
| on | off | yes | no |
| off | on | no | yes |
| off | off | no | no |

That is why an endpoint can be “SDK only” without being publicly useful over plain HTTP.

---

## Server: how types stay in sync with the catalog

Types are **not** shipped inside the runtime catalog as TypeScript. They are generated on demand:

```text
buildEnrichedSdkSurface(gateway)
  → resolve body/query per endpoint (mapper → rules → connector/workflow)
  → buildGatewaySdkTypesArtifact(gateway, surface)
  → export interface ChargeCreateBody { … }
  → export interface CustomerManagement { charge: { create(body?: …) } }
```

Developer downloads that file and passes it as `Surface<CustomerManagement>`. Runtime still uses the JSON catalog; TypeScript only checks your call sites against the downloaded interface.

Schema richness rules (skip weak `{ type: "string" }` stubs, keep field maps that include a field named `type`, etc.) live in `gateway.sdk.surface.ts` so body interfaces do not collapse to `string`.

---

## Why it feels magical (and what is actually simple)

| Feels like | Actually |
|------------|----------|
| Generated SDK methods | One Proxy + string path |
| Client knows your API | Catalog fetched at runtime |
| Typed safety from the server | Separate `.surface.types.ts` download |
| Special SDK protocol | Normal HTTP + HMAC headers |
| Custom router for Surface | Same gateway execute + channel gate |

The clever parts are **Proxy accumulation**, **catalog-driven dispatch**, and **independent HTTP/SDK gates** — not codegen.

---

## Call walkthrough: `api.ledger.balance({ from })`

```text
1. Proxy get "ledger"     → path ["ledger"]
2. Proxy get "balance"    → path ["ledger","balance"]
3. Proxy apply [query]    → invoke(["ledger"], "balance", [query])

4. GET /payment/sdk/surface   (first time; attested)
5. Match op:
     sdk_path: ["ledger"]
     op: "balance"
     method: GET
     endpoint_path: "/ledger/balance"
     query_schema: { … }     → consume args[0] as query
     body: false

6. GET /payment/ledger/balance?from=2026-01-01
     X-API-Key: gw_…
     X-Cliodot-Client: sdk
     X-Cliodot-SDK-Timestamp / Nonce / Signature

7. Server:
     verify API key
     verify attestation → channel "sdk"
     endpointAllowsChannel(sdk) → ok
     run connector/workflow behind /ledger/balance
     return { ok, data }

8. Client returns data
```

---

## Failure points (mental model)

| Symptom | Likely layer |
|---------|----------------|
| `Surface root is not callable` | Called `api()` instead of `api.something()` |
| `SDK operation not exposed` | Proxy path does not match any catalog op (typo / not exposed / SDK disabled → empty ops) |
| `SURFACE_LOAD_FAILED` / 401 on `/sdk/surface` | Auth or attestation on catalog fetch |
| `Missing path argument` | Fluent call omitted a required path param |
| `SURFACE_REQUEST_FAILED` | Gateway/connector error after routing |
| Types say optional but API rejects | Types are soft; connector validation still applies |
| Works in Postman, fails in Surface | Missing attestation or endpoint not `sdk.expose` |
| Works in Surface, fails in Postman | Endpoint HTTP `enabled` is off (SDK-only) |

---

## Source map

| Concern | SDK (`cliodot`) | API (`flowsync-api`) |
|---------|-----------------|----------------------|
| Proxy + invoke | `src/Surface.ts` | — |
| Errors | `src/errors.ts` | — |
| Catalog build | — | `connector-gateway/gateway.sdk.surface.ts` |
| Attestation / gates | — | `connector-gateway/gateway.sdk.util.ts` |
| Enrich + public surface | — | `connector-gateway/gateway.service.ts` |
| Routes | — | `gateway.public.routes.ts`, `gateway.domain.routes.ts`, `gateway.routes.ts` |
| Portal UX | — | `GATEWAY_SDK_SURFACE_FRONTEND_GUIDE.md` |

---

## Related

- Consumer guide: [SURFACE.md](./SURFACE.md)
- Typed connectors (different path): [TYPED_CONNECTOR_EXAMPLES.md](./TYPED_CONNECTOR_EXAMPLES.md)
