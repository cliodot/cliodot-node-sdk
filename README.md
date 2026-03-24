# cliodot

SDK for building workflows, APIs, and functions with Cliodot Flowsync. Define workflows and functions in code, run them locally, and optionally sync with your Flowsync account.

## Installation

```bash
npm install cliodot
```

### Module Support

Cliodot supports both **ES Modules** (recommended for Node.js 16+, TypeScript, and modern frameworks) and **CommonJS**.

**ES Modules (ESM) / TypeScript**
```javascript
import { flosync, v } from 'cliodot';
// or: import { flosync, variable as v } from 'cliodot';
```

**CommonJS (CJS)**
```javascript
const { flosync, v } = require('cliodot');
// or: const { flosync, variable: v } = require('cliodot');
```

**Note for some ESM environments:**
If you encounter `SyntaxError: Named export 'flosync' not found`, use the default import instead:

```javascript
import pkg from 'cliodot';
const { flosync, v } = pkg;
```

Optional peer dependencies:

```bash
npm install mongodb mysql2
```

For PostgreSQL and Redis:

```bash
npm install pg ioredis
```

For password hashing (Argon2, bcrypt):

```bash
npm install argon2 bcrypt
```

## Quick Start

```javascript
import { flosync, v } from 'cliodot';

flosync.configure({
  connectors: {
    'mongodb.system': { uri: process.env.MONGO_URI, database: 'myapp' },
  },
});

const w = flosync.workflow('create-order')
  .http('POST', '/orders')
  .step('save', s => s.db('mongodb', 'insertOne', { collection: 'orders', document: v.body() }))
  .step('respond', s => s.responder('json', { body: v.stepResult('save') }))
  .build();

flosync.register(w);

const result = await flosync.run('create-order', { body: { item: 'Widget', qty: 2 } });
```

### Run Payload

Pass a `body` (or plain object) as the trigger; the engine treats it as `trigger.body` and `trigger.data`. You can also pass:

| Field | Description |
|-------|-------------|
| `body` / `data` | Request body; use `v.body('account')`, `v.body('email')` |
| `headers` | HTTP headers (`v.header('x-api-key')`) |
| `pathParams` | Route params (`v.pathParam('id')`) |
| `params` | Extra params (`v.param('page')`) |
| `query` | Query string params (`v.query('filter')`) |
| `vars` | Override workflow vars (`v.vars('apiKey')`) |
| `envVars` / `env` | Environment overrides (`v.env('MONGO_URI')`) |

```javascript
flosync.run('my-workflow', { body: { id: 1 } });
flosync.run('my-workflow', { body: { id: 1 }, headers: { 'x-request-id': 'abc' }, pathParams: { id: '123' }, query: { page: 1 } });
```

## Configuration

```javascript
flosync.configure({
  apiKey: process.env.FLOSYNC_API_KEY,
  apiSecret: process.env.FLOSYNC_API_SECRET,
  baseUrl: 'http://localhost:8080' //optional,
  projectId: process.env.FLOSYNC_PROJECT_ID,
  connectors: {
    'mongodb.system': { uri: process.env.MONGO_URI, database: 'myapp' },
    'mysql.system': { uri: process.env.MYSQL_URI },
    'postgres.system': { uri: process.env.PG_URI, database: 'myapp' },
    'redis.system': { url: process.env.REDIS_URL },
    'cliodot': { apiKey: process.env.CLIODOT_API_KEY },
  },
  cliodot: { baseUrl: 'https://api.example.com', apiKey: process.env.CLIODOT_API_KEY },
});
```

`baseUrl` defaults to `http://localhost:8080` when omitted. For remote runs (workflows, functions, connectors), only `apiKey` and `apiSecret` are required. Set `CLIODOT_BASE_URL` (or `baseUrl`) to match your main Cliodot API server port.

## Workflows

### Triggers (optional)

Triggers are optional. If you wrap workflows in your own HTTP handler, omit `.http()` and call `flosync.run()` with your payload.

| Method | Description |
|--------|-------------|
| `.http(method, path)` | HTTP trigger (e.g. `POST /orders`) |
| `.job(cron?, timezone?)` | Job/cron trigger (e.g. `'0 * * * *'`, `'UTC'`) |
| `.schedule(cron, timezone?)` | Alias for scheduled jobs |
| `.webhook(method, path)` | Alias for `.http()` |

```javascript
flosync.workflow('api-order').http('POST', '/orders').step(...).build();
flosync.workflow('daily-job').job('0 0 * * *', 'UTC').step(...).build();
flosync.workflow('manual').step(...).build();
```

### Variable references

Use `variable` (or `v`) instead of typing `{{ }}`:

| Method | Example | Resolves to |
|--------|---------|-------------|
| `v.body(...path)` | `v.body('amount')`, `v.body('user', 'email')` | `{{ body.amount }}`, `{{ body.user.email }}` |
| `v.trigger(...path)` | `v.trigger('email')` | `{{ trigger.email }}` |
| `v.stepResult(stepId, ...path)` | `v.stepResult('charge', 'id')` | `{{ stepResults.charge.id }}` |
| `v.header(key)` | `v.header('x-api-key')` | `{{ headers["x-api-key"] }}` |
| `v.param(key)` | `v.param('page')` | `{{ params["page"] }}` |
| `v.pathParam(key)` | `v.pathParam('id')` | `{{ pathParams["id"] }}` |
| `v.query(key)` | `v.query('filter')` | `{{ query["filter"] }}` |
| `v.vars(key)` | `v.vars('apiKey')` | `{{ vars["apiKey"] }}` |
| `v.env(key)` | `v.env('MONGO_URI')` | `{{ env["MONGO_URI"] }}` |
| `v.args(...path)` | `v.args('amount')` | `{{ args.amount }}` |
| `v.expr(expression)` | `v.expr('length(body.items) * 10')` | `{{ length(body.items) * 10 }}` |

```javascript
import { flosync, v } from 'cliodot';

s.validator({ amount: v.body('amount'), email: v.body('email') });
s.transform({ total: v.stepResult('calculate', 'total'), id: v.stepResult('charge', 'id') });
```

### Step Types

- `connector(id, action, config)` - REST/API call
- `db(engine, action, config)` - MongoDB, MySQL, PostgreSQL, or Redis
- `validator(fields)` - Validate input
- `condition(expr)` - Branch on expression (use `.then()` and `.else()`)
- `transform(mapping)` - Map or transform data
- `call(slug, args)` - Invoke a function
- `auth(connectorId, action, config)` - Authentication
- `util(connectorId, action, config)` - Utility (see [Utilities](#utilities))
- `encrypt(connectorId, action, config)` - Encryption (see [Encryption](#encryption))
- `responder(type, config)` - Return response (json, http, raw, redirect, empty)
- `log(message)` - Log message
- `delay(ms)` - Delay execution

### Branching

Steps that can succeed or fail support `.then()` and `.else()`:

```javascript
.step('validate', s => s.validator({ amount: '{{ trigger.body.amount }}' })
  .then('process')
  .else('error'))
.step('check', s => s.condition('{{ stepResults.validate.amount > 0 }}')
  .then('create')
  .else('invalid'))
```

### Decorator Workflows

You can define workflows using TypeScript decorators instead of the fluent `.workflow().step()` builder.

1. Enable decorators in your consuming project's `tsconfig.json`:

```json
{
  "compilerOptions": {
    "experimentalDecorators": true
  }
}
```

2. Define a workflow class and decorate it with `@Workflow()` and `@Http()` (or `@Job()` / `@Schedule()`).

3. Decorate class methods to create steps. By default, the step ID is the method name.

4. Build and register the workflow with `buildWorkflowFromClass()` or `flosync.registerFromClass()`.

5. Optional: add JavaScript inside the decorated method body.

If a decorated method contains non-empty code, the SDK uses it based on the step decorator option `stage`:

- `stage: "pre"` (default): injects an extra `code` step right before the decorated step. The injected code receives `ctx` with:

- `ctx.input` (previous step output, or trigger data for the first step)
- `ctx.trigger` (trigger payload)
- `ctx.steps` (all previous `stepResults`)
- `ctx.vars` (workflow vars, including anything set via `setVars`)

To pass values to later steps, return an object with `setVars`:

```typescript
return { setVars: { limit: 10 } };
```

Later templates can read them via `v.vars("limit")` (resolves to `{{ vars["limit"] }}`) or `{{ vars.limit }}`.

- `stage: "post"`: executes the method body after the decorated step finishes, and allows overriding the decorated step output directly.

In this mode, return:

```typescript
return { out: <newOutput>, setVars?: { ... } };
```

The overridden output becomes the value of `v.stepResult("<stepId>")` for subsequent steps.

In `stage: "post"`, `ctx.input` is the decorated step output produced by the connector/function call.

Example: list todos using decorators

```typescript
import { flosync, v, Workflow, Http, Connector, Condition, Responder, buildWorkflowFromClass, defineCustomConnector } from "cliodot";

const CarrierStore = defineCustomConnector("carrier.store", {
  listTodos: "listTodos",
});

@Workflow("todos-list-decorators", "Todos List (Decorators)")
@Http("GET", "/todos")
class TodosListDecoratorsWorkflow {
  @Connector(
    CarrierStore.id,
    CarrierStore.actions.listTodos,
    { params: { limit: 10 } },
    { order: 0, stage: "post" }
  )
  list(ctx: any) {
    const todos = Array.isArray(ctx?.input?.todos) ? ctx.input.todos : [];
    const formatted = todos.map((t: any) => {
      const title = String(t?.title ?? "").trim();
      return { ...t, title, title_upper: title.toUpperCase() };
    });
    return { out: { ...(ctx?.input ?? {}), todos: formatted } };
  }

  @Condition(v.stepResult("list", "valid"), { then: "ok", else: "unauth", order: 1 })
  check() {}

  @Responder("json", { body: { todos: v.stepResult("list", "todos") } }, { order: 2 })
  ok() {}

  @Responder("json", { statusCode: 401, body: { error: "Unauthorized" } }, { order: 3 })
  unauth() {}
}

const workflow = buildWorkflowFromClass(TodosListDecoratorsWorkflow);
flosync.register(workflow);
```

If you prefer direct registration:

```typescript
flosync.registerFromClass(TodosListDecoratorsWorkflow);
```

### Decorator workflow: validation, MongoDB, string utilities, shaped JSON

This pattern matches what many APIs do: validate input, derive a slug with `utility.string`, write to MongoDB, return a single JSON object with nested `note` metadata (not a flat dump of raw step outputs).

Configure the database once:

```javascript
flosync.configure({
  connectors: {
    "mongodb.system": { uri: process.env.MONGO_URI, database: "myapp" },
  },
});
```

Workflow (imports: `flosync`, `v`, `Workflow`, `Http`, `Validator`, `Util`, `Db`, `Responder`, `buildWorkflowFromClass`, `ConnectorId`):

```typescript
import {
  flosync,
  v,
  Workflow,
  Http,
  Validator,
  Util,
  Db,
  Responder,
  buildWorkflowFromClass,
  ConnectorId,
} from "cliodot";

@Workflow("notes-create-decorators", "Notes create (decorators)")
@Http("POST", "/decorators/notes")
class NotesCreateDecoratorsWorkflow {
  @Validator(
    { title: v.body("title"), body: v.body("body") },
    { order: 0, then: "slugify", else: "validationError" }
  )
  validate() {}

  @Util(
    ConnectorId.Utility.String,
    "slugify",
    { string: v.body("title") },
    { order: 1 }
  )
  slugify() {}

  @Db(
    "mongodb",
    "insertOne",
    {
      collection: "notes",
      document: {
        title: v.body("title"),
        body: v.body("body"),
        slug: v.stepResult("slugify", "value"),
      },
    },
    { order: 2 }
  )
  persist() {}

  @Responder(
    "json",
    {
      statusCode: 201,
      body: {
        ok: true,
        note: {
          id: v.stepResult("persist", "insertedId"),
          title: v.body("title"),
          slug: v.stepResult("slugify", "value"),
          body: v.body("body"),
        },
      },
    },
    { order: 3 }
  )
  created() {}

  @Responder(
    "json",
    {
      statusCode: 400,
      body: {
        ok: false,
        error: "validation_failed",
        details: v.stepResult("validate", "errors"),
      },
    },
    { order: 4 }
  )
  validationError() {}
}

const notesDecoratorsWorkflow = buildWorkflowFromClass(NotesCreateDecoratorsWorkflow);
flosync.register(notesDecoratorsWorkflow);
```

Example request:

```http
POST /decorators/notes
Content-Type: application/json

{
  "title": "Ship checklist",
  "body": "Pack boxes, print labels, hand off to carrier."
}
```

Example success response body:

```json
{
  "ok": true,
  "note": {
    "id": "65a1b2c3d4e5f6789012345",
    "title": "Ship checklist",
    "slug": "ship-checklist",
    "body": "Pack boxes, print labels, hand off to carrier."
  }
}
```

Example validation failure response body:

```json
{
  "ok": false,
  "error": "validation_failed",
  "details": {
    "title": "Field is required"
  }
}
```

`@Util` is typed the same way as `s.util(ConnectorId.Utility.String, "slugify", { ... })` in the fluent builder. `@Db` supports the `mongodb` and `mysql` engines (see [Database](#database)). Step IDs in `v.stepResult("slugify", "value")` refer to the **method name** you put on each decorated step (after sanitization, dots and hyphens in custom IDs become underscores).

### Custom `execute` connector plus decorators (catalog sample)

For behavior that is not a REST template (in-memory demo data, your own SDK, legacy SOAP adapter, etc.), register a connector with an `execute` function, then call it from decorators with `@Connector` exactly like a built-in connector. This mirrors the `carrier.store` pattern: actions such as `listProducts` and `createProduct`, `options.body` / `options.params` / `options.pathParams` passed from the step config.

Define typed action names and the connector:

```typescript
import { flosync, defineCustomConnector } from "cliodot";

type CatalogProduct = { id: string; name: string; price: number };

const Catalog = defineCustomConnector("acme.catalog", {
  listProducts: "listProducts",
  createProduct: "createProduct",
});

const catalogProducts: CatalogProduct[] = [
  { id: "p_static_1", name: "Starter", price: 0 },
  { id: "p_static_2", name: "Pro", price: 49 },
];

flosync.registerConnector(Catalog.id, {
  _id: Catalog.id,
  type: "system",
  name: "Acme Catalog",
  meta: { category: "catalog" },
  auth: { type: "none" },
  execute: async (action, options) => {
    const body = (options.body ?? {}) as Record<string, unknown>;
    const params = (options.params ?? {}) as Record<string, unknown>;
    const pathParams = (options.pathParams ?? {}) as Record<string, unknown>;
    const merged = { ...params, ...pathParams };

    if (action === Catalog.actions.listProducts) {
      const limitRaw = merged.limit;
      const limit =
        limitRaw === undefined || limitRaw === ""
          ? catalogProducts.length
          : Math.max(0, Number(limitRaw));
      const slice = catalogProducts.slice(0, Number.isFinite(limit) ? limit : catalogProducts.length);
      return { ok: true, products: slice, count: slice.length };
    }

    if (action === Catalog.actions.createProduct) {
      const name = String(body.name ?? "").trim();
      const price = Number(body.price);
      if (!name || Number.isNaN(price)) {
        return { ok: false, error: "name_and_price_required" };
      }
      const id = `p_${Date.now()}`;
      const product: CatalogProduct = { id, name, price };
      catalogProducts.push(product);
      return { ok: true, product };
    }

    return { ok: false, error: "unknown_action" };
  },
});
```

List products with decorator `stage: "post"` to shape the payload (add `price_display`, clamp list) before the responder runs:

```typescript
import {
  flosync,
  v,
  Workflow,
  Http,
  Connector,
  Responder,
  buildWorkflowFromClass,
} from "cliodot";

@Workflow("acme-catalog-list-decorators", "Catalog list (decorators)")
@Http("GET", "/decorators/catalog/products")
class CatalogListDecoratorsWorkflow {
  @Connector(
    Catalog.id,
    Catalog.actions.listProducts,
    { params: { limit: v.query("limit") } },
    { order: 0, stage: "post" }
  )
  list(ctx: any) {
    const input = ctx?.input ?? {};
    const items = Array.isArray(input.products) ? input.products : [];
    const withLabels = items.map((p: CatalogProduct) => ({
      ...p,
      price_display: `$${Number(p.price).toFixed(2)}`,
    }));
    return { out: { ...input, products: withLabels, count: withLabels.length } };
  }

  @Responder(
    "json",
    {
      body: {
        ok: true,
        count: v.stepResult("list", "count"),
        products: v.stepResult("list", "products"),
      },
    },
    { order: 1 }
  )
  respond() {}
}
```

Create product with the same connector; the method body flags bad input and normalizes the successful response:

```typescript
@Workflow("acme-catalog-create-decorators", "Catalog create (decorators)")
@Http("POST", "/decorators/catalog/products")
class CatalogCreateDecoratorsWorkflow {
  @Connector(
    Catalog.id,
    Catalog.actions.createProduct,
    { body: { name: v.body("name"), price: v.body("price") } },
    { order: 0, stage: "post" }
  )
  save(ctx: any) {
    const input = ctx?.input ?? {};
    if (!input.ok) return { out: input };
    const p = input.product as CatalogProduct;
    return {
      out: {
        ...input,
        product: { ...p, price_display: `$${Number(p.price).toFixed(2)}` },
      },
    };
  }

  @Responder(
    "json",
    {
      statusCode: 201,
      body: {
        ok: true,
        product: v.stepResult("save", "product"),
      },
    },
    { order: 1 }
  )
  respond() {}
}
```

Example `POST /decorators/catalog/products` JSON body:

```json
{
  "name": "Enterprise",
  "price": 199
}
```

Example `201` response body:

```json
{
  "ok": true,
  "product": {
    "id": "p_1711286400000",
    "name": "Enterprise",
    "price": 199,
    "price_display": "$199.00"
  }
}
```

Example `GET /decorators/catalog/products?limit=1` response body:

```json
{
  "ok": true,
  "count": 1,
  "products": [
    { "id": "p_static_1", "name": "Starter", "price": 0, "price_display": "$0.00" }
  ]
}
```

Register both workflows with `buildWorkflowFromClass` / `flosync.register` or `flosync.registerFromClass`. Use `flosync.run("<workflow-id>", { body: { ... } })` with the `@Workflow` string ID (the engine also registers the same workflow under `__rawId` when you use kebab-case IDs).

## Functions

```javascript
const validatePayment = flosync.function('validate-payment')
  .input({ amount: 'number', currency: 'string' })
  .step('validate', s => s.validator({ amount: '{{ args.amount }}', currency: '{{ args.currency }}' }))
  .step('format', s => s.transform({ valid: '{{ stepResults.validate.valid }}', amount: '{{ args.amount }}' }))
  .outputFrom('format')
  .build();

flosync.registerFunction(validatePayment);

const result = await flosync.runFunction('validate-payment', { amount: 100, currency: 'USD' });
```

## Run by ID (remote)

When configured with `apiKey`, `apiSecret`, and `baseUrl`, you can run workflows and functions by ID without registering them locally. They are assumed to exist on your account.

```javascript
flosync.configure({ apiKey, apiSecret });

await flosync.run('workflow-id-from-account', { body: { amount: 100 } });
await flosync.runById('workflow-id', { body: { ... } }, { triggerId: 'trigger' });
await flosync.runByWebhook('/orders', 'POST', { body: { ... } });

await flosync.runFunction('function-id-from-account', { amount: 100 });
await flosync.runFunctionById('function-id', { amount: 100 });
```

If a workflow/function is registered locally, `run` / `runFunction` use the local version. If not found and the client is configured, they run remotely. Pass `{ remote: false }` to disable remote fallback.

## Database

Use `s.db(engine, action, config)` or `s.connector(connectorId, action, config)` with built-in database connectors.

| Connector | Engine | Actions |
|-----------|--------|---------|
| `mongodb.system` | mongodb | insertOne, insertMany, findOne, find, updateOne, deleteOne |
| `mysql.system` | mysql | query |
| `postgres.system` | postgres | query |
| `redis.system` | redis | redis.get, redis.set, redis.delete, redis.hset, redis.hget, redis.lpush, redis.lpop, redis.zadd, redis.create_hash, redis.delete_key |

```javascript
s.db('mongodb', 'insertOne', { collection: 'orders', document: v.body() });
s.db('mysql', 'query', { query: 'SELECT * FROM users WHERE id = ?', params: [v.body('id')] });
s.db('postgres', 'query', { query: 'SELECT * FROM users', params: [] });
s.db('redis', 'redis.set', { key: 'cache:user:1', value: v.stepResult('fetch'), ttl: 3600 });
```

Configure in `flosync.configure({ connectors: { 'postgres.system': { uri, database }, 'redis.system': { url } } })`.

## Utilities

Use `s.util(connectorId, action, config)` with built-in utility connectors. Use `ConnectorId.Utility` and `ConnectorActions` or `getConnectorActions(connectorId)` for autocomplete and suggestions.

| Connector | Actions |
|-----------|---------|
| `utility.date_time` | get_current_date, get_current_time, get_current_datetime, format, format_date, parse_date, add_time, subtract_time, diff_between_dates, start_of_day, end_of_day, start_of_week, end_of_week, start_of_month, end_of_month, start_of_year, end_of_year, convert_timezone, get_timezone, list_timezones, is_leap_year, get_unix_timestamp, from_unix_timestamp |
| `utility.string` | concat, split, join, replace, replace_all, trim, trim_start, trim_end, to_uppercase, to_lowercase, capitalize, substring, length, contains, starts_with, ends_with, remove_whitespace, slugify, pad_start, pad_end, reverse, encode_base64, decode_base64, encode_uri, decode_uri, after, after_last, before, before_last, between, between_first, camel, char_at, chop_start, chop_end, contains_all, doesnt_contain, doesnt_start_with, doesnt_end_with, deduplicate, excerpt, finish, start, headline, is, is_ascii, is_json, is_ulid, is_url, is_uuid, is_empty, is_match, kebab, snake, studly, title, lcfirst, ucfirst, ucwords, ucsplit, limit, mask, match, match_all, pad_both, plural, singular, position, random, remove, repeat, replace_array, replace_first, replace_last, replace_matches, replace_start, replace_end, squish, substr, substr_count, substr_replace, swap, take, word_count, word_wrap, words, wrap, unwrap, uuid, ulid, strip_tags, ascii, apa, class_basename |
| `utility.math` | add, subtract, multiply, divide, modulo, power, round, floor, ceil, abs, min, max, average, sum, clamp, random_between, percentage, percentage_of, sqrt, log |
| `utility.random` | random_int, random_float, random_string, random_uuid, uuid, random_boolean, random_choice, random_password, random_hex, random_alphanumeric, random_date, random_color, shuffle_array |
| `utility.compare` | diff_objects, diff_arrays, compare_strings, compare_numbers, compare_dates, is_changed, is_equal, is_not_equal, is_greater_than, is_less_than, is_between, is_empty, is_null_or_undefined, is_same_type, deep_equal, shallow_equal, similarity_score, array_intersection, array_union, array_difference |
| `utility.geo` | calculate_distance, point_in_polygon, get_bounding_box, reverse_geocode, geocode, convert_coordinates |

```javascript
import { ConnectorId, ConnectorActions, getConnectorActions } from 'cliodot';

s.util(ConnectorId.Utility.String, 'slugify', { string: 'Hello World' });
s.util(ConnectorId.Utility.Math, 'clamp', { number: 150, min: 0, max: 100 });
s.util(ConnectorId.Utility.Compare, 'diff_objects', { object1: v.stepResult('prev'), object2: v.body() });
s.util(ConnectorId.Utility.Geo, 'calculate_distance', { lat1: 0, lon1: 0, lat2: 1, lon2: 1 });

const stringActions = getConnectorActions(ConnectorId.Utility.String);
```

## Responders

Use `s.responder(type, config)` with built-in responder types.

| Type | Description |
|------|-------------|
| json | JSON response (default content-type: application/json) |
| http | Same as json, supports custom headers |
| raw | Plain text with custom contentType |
| redirect | 302/301 redirect with Location header |
| empty | 202 with no body |

```javascript
s.responder('json', { body: v.stepResult('data') });
s.responder('raw', { body: 'OK', contentType: 'text/plain' });
s.responder('redirect', { location: 'https://example.com', statusCode: 301 });
s.responder('empty', { statusCode: 202 });
```

## Encryption

Use `s.encrypt(connectorId, action, config)` with built-in encryption connectors. All use Node `crypto`; Argon2 and bcrypt require optional packages.

| Connector | Actions |
|-----------|---------|
| `base64.encryption` | `base64.encode`, `base64.decode` |
| `hash.encryption` | `hash`, `hash.md5`, `hash.sha1`, `hash.sha256`, `hash.sha512` |
| `aes.encryption` | `aes.encrypt`, `aes.decrypt`, `aes.generate_key`, `aes.generate_iv` |
| `rsa.encryption` | `rsa.generate_keypair`, `rsa.encrypt`, `rsa.decrypt`, `rsa.sign`, `rsa.verify` |
| `hmac.encryption` | `hmac.create`, `hmac.verify` |
| `password.encryption` | `password.argon2_hash`, `password.argon2_verify`, `password.pbkdf2_hash`, `password.pbkdf2_verify`, `password.scrypt_hash`, `password.scrypt_verify`, `password.bcrypt_hash`, `password.bcrypt_verify`, `password.generate_salt` |

**Examples:**

```javascript
s.encrypt('hash.encryption', 'hash', { data: v.body('payload'), algorithm: 'sha256' });
s.encrypt('base64.encryption', 'base64.encode', { data: v.stepResult('prev') });
s.encrypt('aes.encryption', 'aes.encrypt', { data: v.body('secret'), key: v.vars('key') });
s.encrypt('rsa.encryption', 'rsa.sign', { data: v.body('payload'), private_key: v.vars('privateKey') });
s.encrypt('hmac.encryption', 'hmac.create', { data: v.body('message'), key: v.vars('secret') });
s.encrypt('password.encryption', 'password.argon2_hash', { password: v.body('password') });
```

**Optional packages:** `password.argon2_hash` / `password.argon2_verify` need `argon2`; `password.bcrypt_hash` / `password.bcrypt_verify` need `bcrypt`. Install with `npm install argon2 bcrypt` if you use those actions.

## Connector Registry

Use `ConnectorId` and `ConnectorActions` for built-in connectors, or `defineCustomConnector` for your own. This gives you autocomplete and avoids typos.

### Built-in connectors

```javascript
import { flosync, ConnectorId, ConnectorActions, getConnectorActions, listBuiltInConnectors } from 'cliodot';

// Database
s.db('mongodb', 'insertOne', { collection: 'orders', document: {} });
s.db('mysql', 'query', { query: 'SELECT 1', params: [] });
s.db('postgres', 'query', { query: 'SELECT 1', params: [] });
s.db('redis', 'redis.set', { key: 'key', value: 'value' });

// Auth
s.auth(ConnectorId.Auth.Bearer, ConnectorActions[ConnectorId.Auth.Bearer][0], { token: '{{ headers.authorization }}' });

// Utility - use ConnectorActions or getConnectorActions for autocomplete
s.util(ConnectorId.Utility.DateTime, 'get_current_datetime', {});
s.util(ConnectorId.Utility.String, 'slugify', { string: 'Hello World' });
s.util(ConnectorId.Utility.Math, 'add', { numbers: [10, 20] });
s.util(ConnectorId.Utility.Random, 'random_uuid', {});
s.util(ConnectorId.Utility.Compare, 'diff_objects', { object1: {}, object2: {} });
s.util(ConnectorId.Utility.Geo, 'calculate_distance', { lat1: 0, lon1: 0, lat2: 1, lon2: 1 });

// Get actions for a connector (for suggestions/autocomplete)
const stringActions = getConnectorActions(ConnectorId.Utility.String);

// List all built-in connectors and their actions
console.log(listBuiltInConnectors());
```

### Custom connectors

Define your connector with typed actions for autocomplete:

```javascript
import { defineCustomConnector } from 'cliodot';

const MyStore = defineCustomConnector('my.store', {
  login: 'login',
  listItems: 'listItems',
  createItem: 'createItem',
});

flosync.registerConnector(MyStore.id, myStoreConnector);

s.connector(MyStore.id, MyStore.actions.login, { body: { email: '{{ body.email }}' } });
s.connector(MyStore.id, MyStore.actions.listItems, {});
```

For a simple list of action names:

```javascript
import { defineCustomConnectorFromList } from 'cliodot';

const MyStore = defineCustomConnectorFromList('my.store', ['login', 'listItems', 'createItem']);
```

## Connectors by ID

Use `s.connector(connectorId, action, config)` with any connector ID. For remote runs, connectors are resolved from your account. For local runs, register connectors first with `flosync.registerConnector(id, connector)` or pass config in `configure({ connectors: { 'connector-id': { ... } } })`.

## API Client

When configured with `apiKey`, `apiSecret`, and `baseUrl`:

```javascript
const client = flosync.getClient();

await flosync.push(workflow);
const wf = await flosync.pull(groupId);

const { workflowGroups, pagination } = await client.workflows.list({ status: 'active', page: 1, limit: 20 });
await client.workflows.run(groupId, triggerId, { payload: { ... } });
await client.workflows.runByWebhook('/orders', 'POST', { body: { ... } });

const functions = await client.functions.list();
await client.functions.push(fn);
const fn = await client.functions.pull(functionId);
await client.functions.invoke(functionId, { args: { ... } });

await client.projects.create({ name: 'My Project' });
const projects = await client.projects.list();
```

### Run connector from online

Execute connectors stored in your Cliodot account:

```javascript
const result = await flosync.runConnector('paystack', 'Initialize Transaction', {
  body: { email: 'user@example.com', amount: 5000, reference: 'ref_123' },
});

const { connectors, pagination } = await client.connectors.list();
const { installations } = await client.connectors.installed();
const connector = await client.connectors.get('paystack');
const data = await client.connectors.execute('paystack', 'Verify Transaction', {
  pathParams: { reference: 'ref_123' },
});
```

| Method | Description |
|--------|-------------|
| `flosync.runConnector(id, action, options, { remote? })` | Run connector (local if registered, else remote) |
| `client.connectors.get(id)` | Get connector definition |
| `client.connectors.list(options?)` | List connectors (type, status, category, page, limit) |
| `client.connectors.search(options?)` | Search public connectors |
| `client.connectors.push(connector)` | Create or update connector (by `_id` or `slug`) |
| `client.connectors.installed(options?)` | List installed connectors |
| `client.connectors.install(id, { auth?, base_url? })` | Install connector |
| `client.connectors.uninstall(id)` | Uninstall connector |
| `client.connectors.execute(id, action, options)` | Execute connector action remotely |

### Workflows

| Method | Description |
|--------|-------------|
| `client.workflows.push(workflow)` | Create or update workflow |
| `client.workflows.pull(groupId)` | Fetch workflow as IWorkflow |
| `client.workflows.list(options?)` | List workflow groups |
| `client.workflows.run(groupId, triggerId, payload)` | Run by trigger ID (payload may include `environment: "dev" \| "prod"`) |
| `client.workflows.runByWebhook(path, method, payload)` | Run by webhook path (payload may include `environment`) |
| `client.workflows.promote(groupId)` | Promote to production |

See [Workflows](../docs/WORKFLOWS.md) for full documentation. See [Building and Pushing Custom Connectors](../docs/BUILDING_CONNECTORS.md) for connectors.

## Custom Connectors

See [Building and Pushing Custom Connectors](../docs/BUILDING_CONNECTORS.md) for full samples of JSON, ConnectorBuilder, and custom execute connectors.

### REST connectors

```javascript
flosync.registerConnector('my-connector', {
  _id: 'my-connector',
  type: 'REST',
  base_url: 'https://api.example.com',
  auth: { type: 'bearer', token: process.env.MY_API_KEY },
  endpoints: [
    { name: 'GetUser', method: 'GET', path: '/users/:id' },
  ],
});
```

### Custom execute connector

For full control, provide an `execute` function. The engine calls it with `(action, options, context)`.

**Connector definition**

```javascript
flosync.registerConnector('my.auth', {
  _id: 'my.auth',
  type: 'system',
  name: 'My Auth',
  meta: { category: 'authentication' },
  auth: { type: 'none' },
  execute: async (action, options, context) => { ... },
});
```

Import types for TypeScript: `ConnectorExecuteOptions`, `ConnectorContext`, `ConnectorExecuteFn` from `cliodot`.

**Execute signature**

```typescript
execute(
  action: string,
  options: ConnectorExecuteOptions,
  context: ConnectorContext
): Promise<unknown>
```

**Options** (from workflow step config):

| Field | When used | Description |
|-------|-----------|-------------|
| `body` | API, auth, db, encrypt | Request body or payload |
| `params` | API | Query params |
| `pathParams` | API | Path params (e.g. `:id` in `/users/:id`) |
| `headers` | API | Extra headers |
| `database` | DB | Database name override |
| `connection_id` | DB | Connection ID override |

**Context** (from run state):

| Field | Description |
|-------|-------------|
| `headers` | HTTP headers from the trigger |
| `connectorConfig` | Per-connector config from `configure({ connectors: { 'id': {...} } })` |
| `env` | Environment overrides |
| `trigger` | Trigger payload (body, pathParams, params, etc.) |
| `stepResults` | Results of previous steps |
| `vars` | Workflow variables |

**Discovering IDs and actions**

- Built-in: `ConnectorId`, `ConnectorActions`, `getConnectorActions(connectorId)`, `listBuiltInConnectors()`
- Custom: `defineCustomConnector(id, actions)` or `defineCustomConnectorFromList(id, ['action1', 'action2'])`

**REST endpoint shape**

```typescript
{
  name: string;           // Action name (matches s.connector(id, name, config))
  action?: string;        // Alias for name
  method: string;        // GET, POST, PUT, DELETE, etc.
  path: string;          // e.g. '/users/:id' or '/orders'
  headers?: Record<string, string>;
  body_schema?: object;
  response_mapping?: Record<string, string>;  // { "userId": "data.id" }
  timeout_ms?: number;
}
```

**Return format**

- API/DB/Encrypt: `{ raw, mapped }` or any object (engine uses `mapped ?? raw`)
- Auth: `{ valid: boolean, token?, user?, error? }` for success/failure branching

## License

MIT
