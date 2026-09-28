# Events SDK

Runtime client for Cliodot Event Apps. Lives in the `cliodot` package (`cliodot-flosync`).

Base path: `/event`  
Auth: `x-cliodot-app-id` + Bearer `eak_…` API key, or app secret.

No Kafka, BullMQ, or broker concepts in this client. Product language is event names + delivery profiles (configured in the portal).

## Install

```bash
npm install cliodot
```

## Configure

```ts
import { Events } from "cliodot";

const events = new Events({
  baseUrl: "https://your-host",
  appId: process.env.EVENT_APP_ID!,
  apiKey: process.env.EVENT_APP_API_KEY!,
  environment: "prod", // optional; omit to follow the project switch
});
```

Or with app secret:

```ts
const events = new Events({
  baseUrl: "https://your-host",
  appId: "evt_app_…",
  appSecret: process.env.EVENT_APP_SECRET!,
});
```

`appApiKey` is accepted as an alias of `apiKey`.

Optional constructor `environment` (`"dev"` \| `"prod"`) sends `x-environment` so connector auth templates resolve against that project env bag. Omit it to follow the project switch. This is separate from publish `environment`, which only routes **workflow** subscribers.

## Errors

Runtime failures that are deployment/config related (unbound or unready delivery profile, missing broker config, etc.) return:

- HTTP `503`
- `code`: `EVENT_DELIVERY_PROFILE_NOT_READY`
- Message like: `Delivery profile "reliable" is not ready. Contact your administrator.`

Broker and driver names are never returned to the SDK.

## Publish

Optional `environment: "dev" | "prod"` (default `"prod"`) routes **workflow** subscribers to the matching workflow env. Webhooks and SSE always receive the event.

```ts
await events.publish("order.created", {
  id: "ord_1",
  amount: 2500,
}, {
  ordering_key: "ord_1",
});
```

Maps to `POST /event/v1/publish` → `{ ok, event_id, accepted }`.

## Subscribe / unsubscribe

```ts
const sub = await events.subscribe({
  events: ["order.created", "payment.completed"],
  name: "checkout-listener",
});

await events.unsubscribe(sub.subscription_id);
```

Creates an SDK-channel subscriber bound to **this computer**. Calling `subscribe()` again on the same machine returns the same `subscription_id` (it updates the event list instead of duplicating). A different computer registers as a new instance and cannot listen to or delete the first computer's subscription.

The instance id is derived automatically (`events.instanceId`). Override only for tests or hosts with unstable machine names:

```ts
new Events({ baseUrl, appId, apiKey, instanceId: "checkout-box-1" });
```

Durable webhook delivery is configured in the portal.

## Listen (SSE)

Node / long-lived process:

```ts
const handle = events.listen(
  { events: ["order.created"] },
  (message) => {
    if ("type" in message && message.type === "connected") {
      console.log("connected", message.listener_id);
      return;
    }
    console.log(message.type, message.payload);
  }
);

handle.close();
```

`listen()` auto-reconnects after disconnects/server restarts (exponential backoff, default 1s → 30s). Pass `reconnect: false` to disable, or tune with `reconnectDelayMs` / `reconnectMaxDelayMs`. Call `handle.close()` to stop reconnecting.

Browser `EventSource` (cannot set custom headers) — use the query-auth URL:

```ts
const url = events.listenUrl({ events: ["order.created"] });
const es = new EventSource(url);
```

Envelope matches webhook delivery:

```json
{
  "id": "<event_id>",
  "type": "order.created",
  "created_at": "…",
  "event_app_id": "evt_app_…",
  "delivery_profile": "reliable",
  "payload": {},
  "metadata": {}
}
```

Webhook remains the durable channel. SSE listen is for live SDK consumers.

## HTTP reference

| Op | Method | Path |
|----|--------|------|
| Publish | POST | `/event/v1/publish` |
| Subscribe | POST | `/event/v1/subscribe` |
| Unsubscribe | DELETE | `/event/v1/subscribe/:subscriptionId` |
| Listen | GET | `/event/v1/listen` |

