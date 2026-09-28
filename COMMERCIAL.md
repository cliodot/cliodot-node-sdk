# Commercial Apps SDK

Runtime client for Cliodot Commercial Apps. Lives in the `cliodot` package (`cliodot-flosync`).

Base path: `/commercial`  
Auth: `x-cliodot-app-id` + Bearer `cak_…` API key, or app secret.

**Portal vs SDK:** Create Commercial apps, features, plans, **destinations** (Event App, webhook, workflow, connector capability), and the **connector payment method** in the Cliodot portal (management API). When a connector has more than one connection/credential, pick `installation_id` on the payment method so charges use that connection. This SDK is for **runtime entitlement decisions, catalog reads, quotes, and payment initiation** from your product backend.

| Client | Use |
|--------|-----|
| `CommercialAppClient` | check / consume / state, catalog, subscribe, invoices, quote, `initiatePayment` / `chargeUsage` / `renew` (`renewSubscription`) / `confirmPayment`, credits, saved cards, usage events, change-plan, seats, licenses, analytics |

Customer refs accept internal id or `customer_key`. Plan/feature refs accept id or key.

## Install

```bash
npm install cliodot
```

## Configure

```ts
import { CommercialAppClient } from "cliodot";

const commercial = new CommercialAppClient({
  baseUrl: "https://your-host",
  appId: process.env.COMMERCIAL_APP_ID!,
  apiKey: process.env.COMMERCIAL_APP_API_KEY!,
  environment: "prod", // optional; omit to follow the project switch
});
```

`appApiKey` aliases `apiKey`. App secret via `appSecret` is also supported.

Optional constructor `environment` (`"dev"` \| `"prod"`) sends `x-environment` so connector auth templates resolve against that project env bag. Omit it to follow the project switch.

## Check entitlement

```ts
const result = await commercial.check({
  customer: "acme-corp",
  feature: "api_calls",
  quantity: 1,
});

if (!result.allowed) {
  throw new Error(result.reason);
}
```

Maps to `POST /commercial/v1/check`.

## Consume usage

Omit `quantity` to use the feature `default_increment` (usually `1`). Recurring plans stay hard quota. `payg` / `hybrid` subscriptions price extra units via entitlement `unit_prices` (accrue + threshold/period-end invoice) or pay-now `topup_packs`. Each consume emits `usage.consumed`.

```ts
await commercial.consume({
  customer: "acme-corp",
  feature: "api_calls",
});
```

Maps to `POST /commercial/v1/consume`. The response includes `breakdown` (`summary`, `unit_amount`, `cost`, plan/pack/overage quantities, wallet vs accrued). `GET .../customers/:id/credits` returns wallet balances and ledger `events` with the same rate line (`20 api_calls × 200 GBP = 4000`).

Pay-now pack (units added only after `confirmPayment`):

```ts
await commercial.entitlementTopup({
  subscriptionId: "com_sub_…",
  feature: "api_calls",
  pack_units: 100,
  payment_input: { email: "billing@acme.com" },
});
```

Prepaid wallet:

```ts
const { credit_balances, events } = await commercial.listCredits("acme-corp", {
  page: 1,
  limit: 20,
});
await commercial.topupCredits({
  customerId: "acme-corp",
  currency: "USD",
  amount: 5000,
  payment_input: { email: "billing@acme.com" },
});
```

Pay unbilled usage now (does not wait for threshold / period end). Omit `amount` to pay **all**; pass minor units to pay a slice:

```ts
const { charge, billed_amount, unbilled_remaining } = await commercial.chargeUsage({
  subscriptionId: "com_sub_…",
  amount: 2000,
  payment_input: { email: "billing@acme.com", callback_url: "https://app.example.com/paid" },
});
```

`initiatePayment` without `invoice` charges the **plan/subscription quote**, not accrued usage. Use `chargeUsage` for unbilled PAYG. Pass an existing usage `invoice` id to `initiatePayment` only to resume that invoice.

Usage / lifecycle history:

```ts
await commercial.listUsageEvents("acme-corp", { feature: "api_calls", page: 1 });
await commercial.listEvents("acme-corp", { page: 1 });
await commercial.listEventTypes();
```

Prefer portal-configured destinations for `usage.charged`, `entitlement.topped_up`, and `credit.*`.

## Customer subscription / state

Primary read for entitlements + usage/limits + trial + seats:

```ts
const state = await commercial.getCustomerSubscription("acme-corp", {
  include_billing: true,
});

console.log(state.plan?.key, state.features.api_calls);
```

Maps to `GET /commercial/v1/customers/:customerId/subscription`.

Thin alias:

```ts
await commercial.state({ customer: "acme-corp" });
```

Maps to `GET /commercial/v1/state?customer=…` (POST `/v1/state` also accepted).

## Plan intervals

Plans expose `interval` as one of `daily`, `weekly`, `monthly`, `quarterly`, `biannual`, `yearly`, `custom`, `lifetime`, `none`.

When `interval` is `custom`, the plan includes `interval_days` (e.g. `3`, `10`). Subscriptions snapshot that as `plan_interval_days` / `billing_interval_days`. Usage period keys and renewals follow the interval (including custom day lengths). Plans are created in the portal management API, not this SDK.

## Catalog reads

All lists are paginated:

```ts
const { plans, pagination } = await commercial.listPlans({ page: 1, limit: 20, q: "pro" });
const { features } = await commercial.listFeatures({ page: 1 });
const { customers } = await commercial.listCustomers({ q: "acme" });
const { subscriptions } = await commercial.listSubscriptions({
  customer: "acme-corp",
  page: 1,
});

await commercial.getPlan("pro");
await commercial.getFeature("api_calls");
await commercial.getCustomer("acme-corp");
await commercial.getSubscription("com_sub_…");

const { invoices } = await commercial.listInvoices({
  customer: "acme-corp",
  status: "processing,paid",
  page: 1,
});
await commercial.getInvoice("com_inv_…");
await commercial.getInvoice({ invoiceId: "com_inv_…" });
await commercial.getInvoice(invoice); // uses invoice._id / reference
```

Archived subscriptions are omitted from lists by default. Use `include_archived: true` or `status: "archived"` to see them.

```ts
await commercial.updateSubscriptionStatus({
  subscriptionId: "com_sub_…",
  status: "cancelled",
});

await commercial.archiveSubscription("com_sub_…");
```

Archive is only allowed for `cancelled`, `expired`, or `suspended` (not active/trial).

Pagination shape:

```ts
{
  totalDocs, totalPages, page, limit, hasNextPage, hasPrevPage
}
```

## Create customer

```ts
await commercial.createCustomer({
  customer_key: "acme-corp",
  name: "Acme Corp",
  email: "billing@acme.com",
});
```

`email` is first-class on the customer. Prefer storing it here so payment mappings can use `{{customer.email}}` instead of asking again in `payment_input`.

## Create subscription (subscribe)

Creates a subscription (and charges via the configured connector payment method when amount due > 0 and not trial-only).

```ts
const { subscription } = await commercial.createSubscription({
  customer: "acme-corp",
  plan: "pro",
  currency: "USD",
  discount_code: "LAUNCH20",
  tax_rate: "ng-vat",
  seats_purchased: 8,
  addons: [{ key: "extra_seat", quantity: 1 }],
  auto_renew: true,
  renewal_mode: "platform",
  skip_trial: false,
  metadata: { source: "api" },
  payment_input: {
    email: "billing@acme.com",
    return_url: "https://app.example.com/paid",
  },
});

// alias
await commercial.subscribe({
  customer: "acme-corp",
  plan: "pro",
  payment_input: { email: "billing@acme.com" },
});
```

Maps to `POST /commercial/v1/subscriptions`.

- `auto_renew` defaults `true`. When `false`, no renew charge; expires at period end.
- `renewal_mode`: `platform` (charge scanner) or `provider` (confirm sync only). Defaults from body → payment method → `platform`.
- `skip_trial: true` skips trial even if the plan has `trial_days`; payment-due creates often land in `pending` until `confirmPayment` (prepaid; needs `commercial_apps_prepaid_enabled`). Amount due + immediate `active` is postpaid (`commercial_apps_postpaid_enabled`).
- Response includes `pricing` (quote totals + line items). Prefer `quote` first for preview, then `createSubscription` with the same pricing fields.

`payment_input` values fill portal mappings with `source: "input"`.

## Payments (connector)

Payment credentials live on an installed Cliodot connector. The portal maps connector action fields to commercial context (`amount`, `plan.key`, …) or runtime `input`. The SDK only sends runtime values + customer/subscription refs.

Use `createSubscription` for checkout. Use `initiatePayment` to charge an existing **plan** invoice or to create a subscription/plan quote invoice. It does **not** invoice accrued PAYG usage — use `chargeUsage` for that.

An app can have many payment methods (Paystack, Stripe, `stripe-card`, Flutterwave, `paystack-card`, etc.). One is marked `is_default`. Pass `card_id` to charge a saved card — that card’s `payment_method_key` is the connector. Without a card id, omit `payment_method` to use the default, or pass a method `key` (or id).

Saved **customer cards** are the instrument that connector charges. Store provider tokens (`authorization_code`, `pm_…`) plus last4/brand/exp — never PAN or CVV.

```ts
const { cards } = await commercial.listCards("acme-corp");
await commercial.addCard("acme-corp", {
  token: "AUTH_xxx",
  last4: "4242",
  brand: "visa",
  payment_method_key: "paystack",
  is_default: true,
});
await commercial.setDefaultCard("acme-corp", "com_card_…");
await commercial.removeCard("acme-corp", "com_card_…");
```

Charge methods accept optional `card` / `card_id`. A card id is enough: the connector is the card’s `payment_method_key` (`stripe-card`, `flutterwave`, `paystack-card`, …). Do not also send `payment_method` — it is ignored when a card id is present. Otherwise the subscription `payment_card_id`, then the customer default (matching connector key) is used. Map Paystack `authorization_code` and Stripe `payment_method` to `{{card.token}}`.

```ts
const { payment_methods } = await commercial.listPaymentMethods();
// [{ key: "paystack", name: "Paystack", is_default: true, ... }, ...]

await commercial.subscribe({
  customer: "acme-corp",
  plan: "pro",
  card_id: "com_card_…",
  payment_input: {
    email: "billing@acme.com",
    return_url: "https://app.example.com/paid",
  },
});
```

### Initiate a charge

Creates/uses an invoice, runs the mapped connector action (e.g. Paystack Initialize Transaction), and leaves the invoice in **`processing`**. It does **not** mark the payment paid — the third party must finish first.

```ts
const { reference, invoice, charge } = await commercial.initiatePayment({
  customer: "acme-corp",
  card_id: "com_card_…",
  // payment_method: "paystack", // only when no card id; key/id, else default
  // subscription: "com_sub_…",
  // invoice: "com_inv_…",
  currency: "NGN",
  input: {
    callback_url: "https://app.example.com/paid",
  },
});

// invoice.status === "processing"
// reference === invoice._id  → use this for confirm
// charge === provider response only (e.g. authorization_url, access_code)
```

Response shape:

```ts
{
  ok: true, // false if the provider init call itself failed
  reference: "com_inv_…",
  invoice: { _id, status: "processing", currency, amount, total },
  charge: /* direct provider payload */
}
```

Maps to `POST /commercial/v1/payments/initiate`.

### Charge unbilled usage

```ts
await commercial.chargeUsage({
  subscriptionId: "com_sub_…",
  // amount: 2000, // omit = pay all unbilled
  payment_input: { email: "billing@acme.com" },
});
```

Maps to `POST /commercial/v1/subscriptions/:id/charge-usage`. Confirm with `confirmPayment` like any other invoice. Unbilled is reduced only after success.

`input` keys must match portal mappings with `source: "input"` (or `{{input.key}}`). Prefer `{{customer.email}}` in mappings so you do not re-send email.

### Provider renewal (same subscription)

Do **not** create a new subscription. Open a renewal invoice on the current one, then confirm the provider’s charge against that invoice. That confirmation advances the period.

```ts
const { invoice } = await commercial.renewSubscription({
  subscriptionId: "com_sub_…",
});

await commercial.confirmPayment({
  reference: invoice._id,
  status: "succeeded",
  provider_payment_id: "in_123",
});
```

`renew` is an alias of `renewSubscription`. Maps to `POST /commercial/v1/subscriptions/:id/renew` then `POST /commercial/v1/payments/confirm`. The invoice is `open` (`metadata.kind` = `renewal`); Cliodot does not run the connector charge. If the scanner already opened one, `renewSubscription` returns it (`created: false`).

### Confirm payment

Call this from your backend/SDK or frontend after the provider confirms success (webhook, callback, or verify). Until then a platform initiate invoice stays `processing`; a provider renewal invoice stays `open`.

```ts
await commercial.confirmPayment({
  reference,                 // from initiate or renewSubscription
  status: "succeeded",       // succeeded | failed | pending
  provider_payment_id: "tx_123",
});
```

That marks the invoice `paid` / payment `succeeded` (or failed). A `kind: "renewal"` invoice advances the **same** subscription’s period.

Maps to `POST /commercial/v1/payments/confirm`.

### Change plan with payment input

```ts
await commercial.changePlan({
  subscriptionId: "com_sub_…",
  plan: "enterprise",
  discount_code: "LAUNCH20",
  payment_method: "paystack",
  payment_input: {
    email: "billing@acme.com",
  },
});
```

Configure connectors + mappings in the portal Payments screen (management JWT). Runtime selects the connector from `card_id` (card `payment_method_key`), else `payment_method` / default.

## Pricing quote / discounts

Plans support multi-currency `prices[]` + `default_currency`. Opaque `metadata` on price rows/subscriptions is for external ids only (never used in billing math).

```ts
const { quote } = await commercial.quote({
  customer: "acme-corp",
  plan: "pro",
  currency: "NGN",
  discount_code: "LAUNCH20",
  seats_purchased: 8,
  metadata: { crm_deal_id: "D-100" },
});

await commercial.previewDiscount({
  code: "LAUNCH20",
  plan: "pro",
  currency: "USD",
});

await commercial.listDiscounts({ page: 1 });
await commercial.listTaxRates();
await commercial.listAddons();
```

## Change plan / status / pending update

```ts
await commercial.updatePendingSubscription({
  subscriptionId: "com_sub_…",
  plan: "pro",
  discount_code: "LAUNCH20",
  auto_renew: true,
  payment_input: { email: "billing@acme.com" },
});

await commercial.changePlan({
  subscriptionId: "com_sub_…",
  plan: "enterprise",
  apply_at: "immediate",
  usage_rollover: "carry_unused",
  discount_code: "LAUNCH20",
  payment_input: { email: "billing@acme.com" },
});

await commercial.updateSubscriptionStatus({
  subscriptionId: "com_sub_…",
  status: "cancelled",
});
```

`updatePendingSubscription` maps to `PATCH /v1/subscriptions/:id` and only works while status is `pending`.

## Seats

```ts
await commercial.assignSeat({
  customer: "acme-corp",
  subject_key: "user_123",
  email: "user@acme.com",
});

await commercial.unassignSeat({
  customer: "acme-corp",
  subject_key: "user_123",
});
```

## Licenses

```ts
const issued = await commercial.issueLicense({ customer: "acme-corp" });
await commercial.validateLicense({ license_key: issued.license_key });
await commercial.revokeLicense("com_lic_…");
```

## Analytics

```ts
await commercial.analytics({ period: "30d", include_charts: true });
await commercial.analyticsCharts({ period: "30d" });

Multi-currency: pass `currency: "NGN"` to scope money metrics. Without it, use `summary.revenue.by_currency` / `insights.mrr_by_currency` for native totals and `reporting_total` / `mrr_reporting` for the app reporting currency (FX from portal Settings). Charts expose `revenue_by_currency` / `payments_by_currency` plus a reporting series — do not sum mixed currencies.
```

## Lifecycle destinations

Commercial Apps emit lifecycle events (customers, subscriptions, catalog, payments, invoices, seats, licenses, discounts, taxes, usage). Destinations are configured in the **portal**, not this SDK:

- `webhook` — signed HTTPS POST to your URL
- `webhook_app` — internal Webhook App endpoint
- `event_app` — publish into an Event App (event name = lifecycle type; then use Event App SDK listen)
- `workflow` — trigger a workflow
- `capability` — invoke a connector action

Empty `event_types` means all events. Runtime catalog: `GET /commercial/v1/event-types`.

`payment.initiated` payload includes `charge` (the provider response — checkout URL, access_code, client_secret), plus `invoice`, `payment`, `customer`, and `subscription` objects. Other money events carry the same objects, not ids only.

Prepaid / postpaid / pay-as-you-go reuse existing types (no `prepaid.*` / `postpaid.*`):

- Prepaid: `subscription.created` (`payload.status` = `pending`) → `payment.*` / `invoice.*` → `subscription.activated`
- Postpaid: `subscription.created` + `subscription.activated`; later `invoice.*` / `payment.*` / `subscription.renewed`
- Pay as you go / hybrid: `usage.consumed` on every consume; `usage.charged` / `usage.charge_failed` for standalone usage invoices (threshold or period end); `entitlement.topped_up` after a paid pack; `credit.purchased` / `credit.drawn` for the prepaid wallet

## API reference

Server docs: [`COMMERCIAL_APPS_API.md`](../src/app/flowsync/commercial-apps/COMMERCIAL_APPS_API.md)  
Portal UI prompt: [`COMMERCIAL_APPS_FRONTEND_PROMPT.md`](../src/app/flowsync/commercial-apps/COMMERCIAL_APPS_FRONTEND_PROMPT.md)
