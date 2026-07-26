# cliodot

SDK for building workflows, APIs, and functions with Cliodot Flowsync. Define workflows and functions in code, run them locally, and sync with your Cliodot account.

**Full documentation:** [docs.cliodot.com](https://docs.cliodot.com)

## Installation

```bash
npm install cliodot
```

**ES Modules / TypeScript**

```javascript
import { flosync, v } from 'cliodot';
```

**CommonJS**

```javascript
const { flosync, v } = require('cliodot');
```

Optional peer dependencies (install only what you use):

```bash
npm install mongodb mysql2 pg ioredis argon2 bcrypt
```

## Quick start

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

## Configuration

```javascript
flosync.configure({
  apiKey: process.env.FLOSYNC_API_KEY,
  apiSecret: process.env.FLOSYNC_API_SECRET,
  baseUrl: process.env.CLIODOT_BASE_URL,
  projectId: process.env.FLOSYNC_PROJECT_ID,
  connectors: {
    'mongodb.system': { uri: process.env.MONGO_URI, database: 'myapp' },
  },
});
```

For remote runs against your Cliodot account, set `apiKey` and `apiSecret`. `baseUrl` defaults to `http://localhost:8080` when omitted.

## Documentation

All guides, API references, and examples live on **[docs.cliodot.com](https://docs.cliodot.com)**:

| Topic | Docs |
|-------|------|
| Getting started | [docs.cliodot.com/getting-started](https://docs.cliodot.com/getting-started) |
| SDK overview | [docs.cliodot.com/sdk](https://docs.cliodot.com/sdk) |
| Workflows | [docs.cliodot.com/workflows](https://docs.cliodot.com/workflows) |
| Functions | [docs.cliodot.com/functions](https://docs.cliodot.com/functions) |
| Connectors | [docs.cliodot.com/connectors](https://docs.cliodot.com/connectors) |
| Gateway Surface | [SURFACE.md](./SURFACE.md) |
| Surface internals | [SURFACE_INTERNALS.md](./SURFACE_INTERNALS.md) |
| Typed connectors | [TYPED_CONNECTOR_EXAMPLES.md](./TYPED_CONNECTOR_EXAMPLES.md) |
| API client | [docs.cliodot.com/api-client](https://docs.cliodot.com/api-client) |
| OAuth apps | [docs.cliodot.com/oauth-apps](https://docs.cliodot.com/oauth-apps) |
| Auth apps (MFA) | [docs.cliodot.com/auth-apps](https://docs.cliodot.com/auth-apps) |

## License

MIT
