# Memory Apps SDK

Runtime clients for Cliodot Memory Apps. Lives in the `cliodot` package (`cliodot-flosync`).

Base path: `/memory`  
Auth: `x-cliodot-app-id` + Bearer `mak_…` API key, or app secret.

**Portal vs SDK:** Create Memory apps, collections, embedding profiles, retention policies, and groups in the Cliodot portal. This SDK is for **runtime Learn + Recall only**.

| Client | Use |
|--------|-----|
| `MemoryAppClient` | Store / get / update / delete / find / search |
| `MemoryClient` | Alias with `searchCross` for multi-app / group search |

Objects are addressed by **`{ collection, id }`**. User-provided `id` values (e.g. `TXN-001`) become the object `_id`.

When `collections` / `collection` are omitted on search, **all collections** in scope are searched. Pass `apps` (Memory App slugs or ids) to search across apps.

## Install

```bash
npm install cliodot
```

## Configure

```ts
import { MemoryAppClient } from "cliodot";

const memory = new MemoryAppClient({
  baseUrl: "https://your-host",
  appId: process.env.MEMORY_APP_ID!,
  apiKey: process.env.MEMORY_APP_API_KEY!,
});
```

`appApiKey` aliases `apiKey`. App secret via `appSecret` is also supported.

## Store

```ts
await memory.store({
  collection: "transactions",
  type: "transaction",
  id: "TXN-001",
  content: {
    customer_id: "CUS-1022",
    amount: 5000,
    currency: "NGN",
    status: "failed",
    reason: "insufficient_funds",
  },
});
```

Maps to `POST /memory/v1/store`.

## Bulk store

```ts
await memory.storeMany({
  collection: "transactions",
  items: [
    { id: "TXN-002", content: { amount: 100 } },
    { id: "TXN-003", content: { amount: 200 } },
  ],
});
```

Maps to `POST /memory/v1/store-many`.

## Get

```ts
await memory.get({
  collection: "transactions",
  id: "TXN-001",
});
```

Maps to `POST /memory/v1/get`.

## Update

Content keys are **shallow-merged** into the existing object.

```ts
await memory.update({
  collection: "transactions",
  id: "TXN-001",
  content: {
    status: "resolved",
  },
});
```

Maps to `POST /memory/v1/update`.

## Delete

```ts
await memory.delete({
  collection: "transactions",
  id: "TXN-001",
});
```

Maps to `POST /memory/v1/delete` (`mode: "soft"` default, or `"permanent"`).

## Find by filter

`filter` matches equality on **content** fields.

```ts
await memory.find({
  collection: "transactions",
  filter: {
    customer_id: "CUS-1022",
    status: "failed",
  },
});
```

Maps to `POST /memory/v1/find`.

## Search

Single-app (all collections when none given):

```ts
await memory.search({
  query: "failed payment made by James",
  collections: ["transactions", "support_tickets"],
  limit: 10,
});
```

Cross-app by slug:

```ts
await memory.search({
  apps: ["customer-memory", "finance-memory", "support-memory"],
  query: "Why did James stop paying?",
});
```

Omit `collections` / `collection` to search every collection in the selected app(s).

Maps to `POST /memory/v1/search` (delegates to cross-app when `apps` / `group` is set).

## MemoryClient alias

```ts
import { MemoryClient } from "cliodot";

const client = new MemoryClient({ /* same config */ });
await client.searchCross({
  apps: ["customer-memory", "finance-memory"],
  query: "refund policy",
});
```

`searchCross` requires `apps[]` or `group`; otherwise use `search`.

## Errors

| Code | Meaning |
|------|---------|
| `MEMORY_UNAUTHORIZED_APP` | Missing/invalid credentials |
| `MEMORY_OBJECT_NOT_FOUND` | Object missing / wrong collection |
| `MEMORY_APP_NOT_FOUND` | Unknown app slug/id in `apps[]` |
| `MEMORY_QUOTA_EXCEEDED` | Object quota hit |
| `MEMORY_SEARCH_FAILED` | Vector index missing or search failed |
| `IDENTITY_PRODUCT_SECRET_DISABLED` | Identity Provider linked |

## HTTP reference

| Op | Method | Path |
|----|--------|------|
| Store | POST | `/memory/v1/store` |
| Store many | POST | `/memory/v1/store-many` |
| Get | POST | `/memory/v1/get` |
| Update | POST | `/memory/v1/update` |
| Delete | POST | `/memory/v1/delete` |
| Find | POST | `/memory/v1/find` |
| Search | POST | `/memory/v1/search` |

Path aliases remain for `GET/PATCH/DELETE /memory/v1/objects/:id`.

## Related

- Portal API: [`MEMORY_APPS_API.md`](../src/app/flowsync/memory-apps/MEMORY_APPS_API.md)
