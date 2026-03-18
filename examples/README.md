# Cliodot Flosync Examples

Example projects showcasing workflows, functions, connectors, auth, and more.

## Run All (no MongoDB)

```bash
cd examples && node 10-run-all.js
```

## Individual Examples

| File | Description |
|------|-------------|
| `01-payment-gateway.js` | Payment flow with bearer auth, function, condition, validator, util |
| `02-custom-connector-stripe.js` | Custom REST connector (Stripe-style), validator, transform |
| `03-api-with-auth.js` | Protected API with bearer auth, vars |
| `04-ecommerce-order.js` | Order creation with MongoDB, function, validator |
| `05-scheduled-job.js` | Job trigger, util (datetime), transform |
| `06-data-pipeline.js` | Transform, encrypt (hash, base64), manual trigger |
| `07-user-registration.js` | User signup with MongoDB, function, validator, encrypt |
| `08-webhook-processor.js` | Manual trigger, headers, vars, condition |
| `09-full-stack.js` | Function, validator, transform, custom connector |
| `10-run-all.js` | Runs examples 01, 02, 03, 05, 06, 08, 09 |
| `11-hybrid-local-remote.js` | Local workflow + remote workflow via `callWorkflow` |
| `12-custom-connector-discord.js` | Custom Discord connector (from connectors/discord.json) |
| `13-validator-groups.js` | Validation groups with multiple validators (not_empty, contains, ends_with) |

## MongoDB Examples

For `04-ecommerce-order.js` and `07-user-registration.js`:

```bash
export MONGO_URI="mongodb://localhost:27017"
node 04-ecommerce-order.js
node 07-user-registration.js
```

## Features Demonstrated

- **Triggers**: `.http()`, `.job()`, manual (no trigger)
- **Steps**: validator (with groups), condition, transform, connector, db, auth, util, encrypt, call (function), responder
- **Functions**: `flosync.function()`, `runFunction()`, `call()` in workflows
- **Custom connectors**: `connector(id).baseUrl().bearer().post().build()` with optional `params`, `body`, `headers`, `response_mapping`, `body_schema`, `description`, `timeout_ms`, `meta`
- **Auth**: bearer, api_key
- **Payload**: body, headers, pathParams, query, vars
- **Hybrid**: `callWorkflow()` to invoke remote workflows from local workflows

## Validator groups

Validator steps support validation groups. Each group has `fields` (template expressions) and `validators` (all applied to each field). Validators: `not_empty`, `is_empty`, `contains`, `not_contains`, `begins_with`, `ends_with`, `is_in`, `not_in`, `is_email`, `is_phone`, `length`, `range`, `matches`, `is_number`, `is_string`, `is_boolean`, `is_array`, `is_object`, `equals`, `not_equals`, `greater_than`, `less_than`, `is_url`, `is_date`, `is_address`, and custom.

```javascript
s.validator([
  { fields: [v.body('name'), v.body('email')], validators: [{ name: 'not_empty' }, { name: 'contains', config: { search: 'relevar' } }] },
  { fields: [v.body('name')], validators: [{ name: 'ends_with', config: { suffix: '.com' } }] },
])
```

## Discord connector

`12-custom-connector-discord.js` uses the Discord connector (based on `connectors/discord.json`). Without `DISCORD_BOT_TOKEN` it mocks the response. With token and `DISCORD_CHANNEL_ID`, it sends real messages.

## Hybrid (local + remote)

`11-hybrid-local-remote.js` runs locally when no API is configured. With `FLOSYNC_BASE_URL`, `FLOSYNC_API_KEY`, `FLOSYNC_API_SECRET` set, it calls a remote workflow via `callWorkflow()`. Ensure a `checkout` workflow exists on your account, or change the workflow ID.
