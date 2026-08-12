# Commercial Apps SDK

Runtime client for Cliodot Commercial Apps. Lives in the `cliodot` package (`cliodot-flosync`).

Base path: `/commercial`  
Auth: `x-cliodot-app-id` + Bearer `cak_…` API key, or app secret.

**Portal vs SDK:** Create Commercial apps, features, plans, and the **connector payment method** in the Cliodot portal (JWT management API). This SDK is for **runtime entitlement decisions, catalog reads, quotes, and payment initiation** from your product backend.

| Client | Use |
|--------|-----|
| `CommercialAppClient` | check / consume / state, catalog reads, `createCustomer`, `createSubscription` / `subscribe`, `listInvoices` / `getInvoice`, quote/discounts, `initiatePayment` / `confirmPayment`, change-plan, seats, licenses, analytics |

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
});
```

`appApiKey` aliases `apiKey`. App secret via `appSecret` is also supported.

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

Omit `quantity` to use the feature `default_increment` (usually `1`).

```ts
await commercial.consume({
  customer: "acme-corp",
  feature: "api_calls",
});
```

Maps to `POST /commercial/v1/consume`.

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

Prefer `quote` first for totals preview, then `createSubscription` with the same pricing fields. `payment_input` values fill portal mappings with `source: "input"`.

## Payments (connector)

Payment credentials live on an installed Cliodot connector. The portal maps connector action fields to commercial context (`amount`, `plan.key`, …) or runtime `input`. The SDK only sends runtime values + customer/subscription refs.

Use `createSubscription` for checkout. Use `initiatePayment` to charge an existing subscription/invoice without creating a new sub.

An app can have many payment methods (Paystack, Stripe, bank transfer, etc.). One is marked `is_default`. Omit `payment_method` to use the default; pass a method `key` (or id) to use a specific one.

```ts
const { payment_methods } = await commercial.listPaymentMethods();
// [{ key: "paystack", name: "Paystack", is_default: true, ... }, ...]

await commercial.subscribe({
  customer: "acme-corp",
  plan: "pro",
  payment_method: "paystack",
  payment_input: { email: "billing@acme.com" },
});
```

### Initiate a charge

Creates/uses an invoice, runs the mapped connector action (e.g. Paystack Initialize Transaction), and leaves the invoice in **`processing`**. It does **not** mark the payment paid — the third party must finish first.

```ts
const { reference, invoice, charge } = await commercial.initiatePayment({
  customer: "acme-corp",
  // payment_method: "paystack", // optional key/id; defaults to is_default
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

`input` keys must match portal mappings with `source: "input"` (or `{{input.key}}`). Prefer `{{customer.email}}` in mappings so you do not re-send email.

### Confirm payment

Call this from your backend/SDK or frontend after the provider confirms success (webhook, callback, or verify). Until then the invoice stays `processing`.

```ts
await commercial.confirmPayment({
  reference,                 // from initiate
  status: "succeeded",       // succeeded | failed | pending
  provider_payment_id: "tx_123",
});
```

That marks the invoice `paid` / payment `succeeded` (or failed). Renewals deferred with `renewal_mode: "provider"` use the same confirm path.

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

Configure connectors + mappings in the portal Payments screen (management JWT). Runtime only selects which method via `payment_method` / default.

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

## Change plan / status

```ts
await commercial.changePlan({
  subscriptionId: "com_sub_…",
  plan: "enterprise",
  discount_code: "LAUNCH20",
  payment_input: { email: "billing@acme.com" },
});

await commercial.updateSubscriptionStatus({
  subscriptionId: "com_sub_…",
  status: "cancelled",
});
```

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

## API reference

Server docs: [`COMMERCIAL_APPS_API.md`](../src/app/flowsync/commercial-apps/COMMERCIAL_APPS_API.md)  
Portal UI prompt: [`COMMERCIAL_APPS_FRONTEND_PROMPT.md`](../src/app/flowsync/commercial-apps/COMMERCIAL_APPS_FRONTEND_PROMPT.md)
