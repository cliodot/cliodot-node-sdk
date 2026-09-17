# Commercial Ledger SDK

Wallets, accounts, entries, transactions, holds, units, and exchange live on the **same Commercial App**. Use `CommercialAppClient` — there is no `WalletAppClient`, no `wak_` keys, and no `wal:` Identity prefix.

Base path: `/commercial`  
Auth: `x-cliodot-app-id` + Bearer `cak_…` or app secret. Linked Identity uses `com:<com_app_id>:…` scopes.

Credits routes (`listCredits` / `topupCredits`) remain the default-wallet facade. Topups fund wallets when Commercial Ledger is mounted.

Full API: `[COMMERCIAL_LEDGER_API.md](../../src/app/flowsync/commercial-ledger/COMMERCIAL_LEDGER_API.md)`

## Scopes

Prefix `com`. `com:<com_app_id>:manage` implies all.


| Scope       | Methods                                                                                                                                                                                             |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ledger`    | `listWallets`, `createWallet`, `updateWallet`, `getWallet`, `listAccounts`, `getAccount`, `listEntries`, `listTransactions`, `getTransaction`, `listWalletFees`, `listFees`, `getFee`, `settleTransaction`, `voidTransaction`, `ledgerAnalytics`, `ledgerAnalyticsCharts` |
| `credit`    | `credit`                                                                                                                                                                                            |
| `debit`     | `debit`                                                                                                                                                                                             |
| `transfer`  | `transfer`                                                                                                                                                                                          |
| `reverse`   | `reverseTransaction`                                                                                                                                                                                |
| `holds`     | `listHolds`, `hold`, `captureHold`, `releaseHold`, `authorizeDebit`, `completeDebit`, `failDebit`                                                                                                    |
| `units`     | `listUnits`, `createUnit`                                                                                                                                                                           |
| `exchange`  | `exchange`                                                                                                                                                                                          |
| `payments`  | `topupCredits` (invoice)                                                                                                                                                                            |
| `customers` | `listCredits`                                                                                                                                                                                       |




## Wallets

```ts
const { wallets } = await commercial.listWallets("acme-corp", { page: 1, limit: 20 });
const created = await commercial.createWallet("acme-corp", {
  key: "ops",
  name: "Operations float",
  units: [
    "USD",
    { unit: "NGN", metadata: { display: "Naira" }, settlement: { settle_in: "T+1" } },
  ],
  metadata: { purpose: "prepaid", region: "ng" },
  settlement: { settle_in: "1d" },
  fees: {
    debit: { type: "percent_plus_flat", percent_bps: 150, flat: 100, mode: "on_top" },
    credit: { type: "percent", percent_bps: 50, mode: "inclusive" },
    collector: { customer: "platform", key: "fees" },
  },
});
await commercial.updateWallet("acme-corp", created.wallet._id, {
  metadata: { purpose: "float" },
  settlement: { settle_in: "T+0" },
  fees: {
    debit: { type: "flat", flat: 150 },
    collector: "com_wal_…",
  },
});
await commercial.openAccount("acme-corp", created.wallet._id, {
  unit: "GBP",
  metadata: { display: "Pound sterling" },
});
await commercial.updateAccount("acme-corp", created.wallet._id, "com_wacc_…", {
  metadata: { hold_note: "review" },
  settlement: { settle_in: "T+2" },
});
const { wallet, accounts } = await commercial.getWallet("acme-corp", created.wallet._id);
const { accounts: listed } = await commercial.listAccounts("acme-corp", wallet._id);
const { account } = await commercial.getAccount(listed[0]._id);
await commercial.getAccount("USD", { walletId: wallet._id });
await commercial.getAccount(listed[0]._id, {
  customerId: "acme-corp",
  walletId: wallet._id,
});
```

`getAccount(accountId)` is enough. `customerId` and `walletId` are optional scopes. Unit code (`USD`) only resolves when `walletId` is also passed.

Account GET fields: `available`, `held`, `unsettled`, `total` (`available + held + unsettled`). Consume and debit spend **available** only.

## Entries and transactions

```ts
await commercial.listEntries("acme-corp", wallet._id, { page: 1, q: "topup" });
await commercial.listTransactions("acme-corp", wallet._id, {
  page: 1,
  q: "Purposeful Debit 120300",
});
await commercial.listTransactions({
  reference: "pay_01",
  amount: 1500,
  unit: "USD",
});
await commercial.getTransaction("com_wtx_…");
```



## Fees (wallet policy)

Needs `commercial_ledger_fees_enabled`. Configure once on the wallet (or a unit row). Every later `credit` / `debit` / `transfer` uses that policy unless the call overrides it.

```ts
await commercial.createWallet("acme-corp", {
  key: "ops",
  units: [
    "USD",
    {
      unit: "NGN",
      fees: {
        debit: { type: "flat", flat: 5000, mode: "on_top" },
        credit: null,
      },
    },
  ],
  fees: {
    credit: {
      type: "percent",
      percent_bps: 50,
      mode: "inclusive",
      reason: "credit_fee",
    },
    debit: {
      type: "percent_plus_flat",
      percent_bps: 150,
      flat: 100,
      min: 50,
      max: 200_000,
      mode: "on_top",
      reason: "processing",
    },
    transfer: { type: "flat", flat: 75, mode: "on_top" },
    collector: { customer: "platform", key: "fees" },
  },
});

await commercial.updateWallet("acme-corp", wallet._id, {
  fees: {
    debit: { type: "flat", flat: 150 },
    collector: "com_wal_…",
  },
});
await commercial.updateWallet("acme-corp", wallet._id, { fees: null });
```

Resolution on each movement: request `fee` → `wallet.units[unit].fees[op]` → `wallet.fees[op]` (transfer falls back to `debit`) → none. A unit row `fees: null` turns fees off for that unit. `transfer: null` disables transfer fees without changing debit.

| Field | Meaning |
|-------|---------|
| `type` | `percent` \| `flat` \| `percent_plus_flat` |
| `percent_bps` | 0–10000 (150 = 1.5%). Required for percent types |
| `flat` / `min` / `max` | Minor units. At least one of bps/flat must be > 0 |
| `mode` | `on_top` or `inclusive`. Default: debit/transfer `on_top`, credit `inclusive` |
| `collector` | `com_wal_…` or `{ customer, key? }` in this app. Not the charged wallet |
| `reason` | Label on the `fee` / `fee_income` entries |

Fee = `clamp(round_half_up(principal * bps / 10000) + flat, min, max)`.

| Movement | `on_top` | `inclusive` |
|----------|----------|-------------|
| **Credit** | Wallet **+principal**. Fee is `charged_to: counterparty` (payer outside the wallet). No `fee` entry on the wallet. Collector still credited when set. | Wallet **+(principal − fee)**. Entries: `credit` principal + `fee` fee. Rejected if `fee >= principal`. |
| **Debit** | Wallet **−(principal + fee)**. Funds check uses that gross. | Wallet **−principal**. Recipient net is principal − fee. Rejected if `fee >= principal`. |
| **Transfer** | Source follows debit; dest receives **principal**. | Source follows debit; dest receives **principal − fee**. |

The fee shares the **same transaction and `reference`** as the principal on the charged wallet. An internal collector sweep also writes a **credit** on the collector wallet (`origin: fee`, amount = fee) so it shows in that wallet’s transaction list. Reverse the original movement (that also reverses the fee credit). Collector sweep is best-effort (`resolution: internal` or `external` + `collector_error`); a missing collector never fails the movement.

`authorizeDebit` accepts a request-only `fee` (wallet policy is never applied). Holds / exchange / delayed settle do not take a fee.

## Credit

Scope `credit`. `reference` is required and idempotent. Amounts are minor units.

```ts
import { CommercialLedgerSettleIn } from "cliodot";

const credited = await commercial.credit("acme-corp", wallet._id, {
  unit: "USD",
  amount: 10_000,
  reference: "topup_inv_01",
  reason: "card_topup",
  invoice_id: "com_inv_01",
  settle_in: CommercialLedgerSettleIn.T1,
  metadata: { order_id: "ord_991", channel: "pos" },
});

credited.transaction?.amount;       // 10000 principal
credited.transaction?.gross_amount;
credited.transaction?.fee_amount;
credited.transaction?.net_amount;   // 10000 − fee when credit is inclusive
credited.transaction?.fee;          // { amount, mode, charged_to, source, … }
credited.balance_after;
```

Omit `fee` to apply the wallet/unit **credit** rule. Override per call:

```ts
await commercial.credit("acme-corp", wallet._id, {
  unit: "USD",
  amount: 10_000,
  reference: "topup_waive",
  reason: "promo",
  fee: false,
  metadata: { campaign: "launch" },
});

await commercial.credit("acme-corp", wallet._id, {
  unit: "USD",
  amount: 10_000,
  reference: "topup_explicit",
  reason: "partner",
  fee: { amount: 150, mode: "inclusive", reason: "partner_fee" },
});

await commercial.credit("acme-corp", wallet._id, {
  unit: "USD",
  amount: 10_000,
  reference: "topup_ontop",
  reason: "card_topup",
  fee: { amount: 150, mode: "on_top" },
});
```

`fee: false` waives the policy. `{ amount, mode?, reason? }` books a fixed fee (`source: request`). Inclusive credit: wallet nets `amount − fee`. On-top credit: wallet gets the full `amount`; the fee is on the counterparty.

`invoice_id` needs `commercial_ledger_providers_enabled`. Delayed `settle_in` / `settle_at` needs `commercial_ledger_settlement_enabled` — settle or void the pending header:

```ts
await commercial.settleTransaction("com_wtx_…");
await commercial.voidTransaction("com_wtx_…");
```

`metadata` is stored on the transaction and copied onto every entry (principal, fee, fee_income).

## Debit

Scope `debit`. Hard fail `400 COMMERCIAL_LEDGER_INSUFFICIENT_FUNDS` when available cannot cover the draw (principal **plus** an `on_top` fee). Same `reference` replays the existing debit (no second fee).

```ts
const spent = await commercial.debit("acme-corp", wallet._id, {
  unit: "USD",
  amount: 2500,
  reference: "spend_01",
  reason: "order",
  metadata: { sku: "sku_1", order_id: "ord_991" },
});

spent.drawn;                        // 2500 principal
spent.balance_after;
spent.transaction?.gross_amount;    // 2500 + fee when on_top
spent.transaction?.fee_amount;
spent.transaction?.net_amount;
spent.transaction?.fee?.source;     // "wallet" | "unit" | "request"
spent.transaction?.entries;         // debit + fee (same reference)
```

Omit `fee` to apply the wallet/unit **debit** rule. Override per call:

```ts
await commercial.debit("acme-corp", wallet._id, {
  unit: "USD",
  amount: 2500,
  reference: "spend_waive",
  reason: "refund_adjust",
  fee: false,
});

await commercial.debit("acme-corp", wallet._id, {
  unit: "USD",
  amount: 2500,
  reference: "spend_explicit",
  reason: "order",
  fee: { amount: 75, mode: "on_top", reason: "gateway" },
  metadata: { sku: "sku_1" },
});

await commercial.debit("acme-corp", wallet._id, {
  unit: "USD",
  amount: 2500,
  reference: "spend_inclusive",
  reason: "payout",
  fee: { amount: 150, mode: "inclusive" },
});
```

On-top debit of `2500` with fee `75` needs **2575** available. Inclusive debit of `2500` with fee `150` spends `2500`; net after fee is `2350`. Inclusive `fee >= amount` → `400 COMMERCIAL_LEDGER_FEE_EXCEEDS_AMOUNT`.

## Transfer / reverse

Scope `transfer` / `reverse`. Source wallet’s **transfer** rule (or `debit` fallback) applies. Dest does not take a credit fee.

```ts
const moved = await commercial.transfer("acme-corp", wallet._id, {
  to: { customer: "globex", key: "default" },
  unit: "USD",
  amount: 1000,
  reference: "xfer_01",
  fee: { amount: 75, mode: "on_top" },
  metadata: { payout_id: "pay_01" },
});

await commercial.reverseTransaction(moved.transaction._id, { reference: "rev_01" });
```

`to` is a dest wallet id or `{ customer, key? }`. Dest must already exist. Same `reference` returns the existing transfer.

## List fees

Runtime scope `ledger`.

```ts
await commercial.listWalletFees("acme-corp", wallet._id, {
  unit: "USD",
  resolution: "internal",
  operation: "debit",
  status: "charged",
  page: 1,
});
await commercial.listFees({
  collector_wallet_id: "com_wal_…",
  from: "2026-01-01T00:00:00.000Z",
});
const { fee } = await commercial.getFee("com_wfee_…");
const { transaction } = await commercial.getTransaction("com_wtx_…");
transaction.fee_detail;
```

Rows are `CommercialWalletFee` (`com_wfee_…`). Destinations: `wallet.fee_charged` / `wallet.fee_reversed`. Credited / debited / transferred envelopes also include a fee summary, `gross_amount`, `net_amount`, and `metadata`. Full API: [COMMERCIAL_LEDGER_API.md](../../src/app/flowsync/commercial-ledger/COMMERCIAL_LEDGER_API.md#fees).

## Authorize debit

A debit that starts in `status: hold` (available → held). Complete it in place, or fail it (same debit → `failed` plus a credit). This is **not** `hold()` / `captureHold()` / `releaseHold()`, and it is **not** `debit()`.

`authorizeDebit` accepts `unit`, `amount`, `reason`, optional `reference`, `metadata`, and a **request-only** `fee`. Wallet/unit debit **amount** policy is never applied — a fee is reserved only when the caller passes `{ amount, mode?, reason?, collector? }`. The wallet/unit **collector** is used unless `fee.collector` overrides it. Omit `fee` or pass `fee: false` for no fee. `completeDebit` / `failDebit` take optional `reason` (and `reference` on fail).

An explicit on-top fee is reserved with the principal (`available → held` of `amount + fee`). Inclusive fee reserves `amount` only. The fee is **booked on complete** (same transaction / reference as a debit). Fail releases the reserved amount and does **not** charge the fee.

```ts
const authorized = await commercial.authorizeDebit("acme-corp", "default", {
  unit: "USD",
  amount: 200,
  reason: "order_pending",
  reference: "ord_01",
  metadata: { order_id: "ord_01" },
  fee: {
    amount: 15,
    mode: "on_top",
    reason: "gateway",
    collector: { customer: "platform", key: "fees" },
  },
});

authorized.transaction.status;       // "hold"
authorized.transaction.origin;       // "authorize"
authorized.transaction.amount;       // 200
authorized.transaction.fee_amount;   // 15
authorized.transaction.gross_amount; // 215 — reserved

await commercial.completeDebit(authorized.transaction._id, {
  reason: "paid in full",
});

await commercial.failDebit("com_wtx_…", {
  reference: "ord_01_fail",
  reason: "card declined",
});
```

Needs `commercial_ledger_holds_enabled` and scope `holds`. An explicit fee also needs `commercial_ledger_fees_enabled`. Same `reference` returns the existing authorized debit. `debit()` cannot reuse that reference.

Workflow connector `commercial.system` exposes the same optional inputs on Credit / Debit / Transfer (`fee` with `amount` / `mode` / `reason`, `waive_fee`, `metadata`) and on Create / Update wallet (`fees` with credit / debit / transfer / collector). Authorize debit accepts `metadata` plus request-only `fee` / `waive_fee` (wallet policy is ignored). Re-sync system connectors after a schema change so the builder picks up the fields.

`listCredits` / `topupCredits` still work. Confirmed topup credits the default wallet (or `400 COMMERCIAL_WALLET_NOT_FOUND` when `auto_create_wallet_on_topup` is false and no wallet exists).

## Holds

```ts
await commercial.listHolds("acme-corp", wallet._id, { status: "open" });
const held = await commercial.hold("acme-corp", "default", {
  unit: "USD",
  amount: 200,
  reason: "order_pending",
  reference: "escrow_01",
});
await commercial.captureHold("acme-corp", "default", "com_whld_…");
await commercial.releaseHold("acme-corp", "default", "com_whld_…");
```

`customerId` accepts `_id` or `customer_key`. `walletId` accepts `_id` or wallet `key`.



## Units and exchange

```ts
await commercial.listUnits();
await commercial.createUnit({ code: "PTS", name: "Points", precision: 0 });
await commercial.exchange("acme-corp", wallet._id, {
  from: { unit: "USD", amount: 1000 },
  to: { unit: "NGN" },
  rate: "1500.00",
  reference: "fx_01",
});
```

ISO codes such as `USD` work at precision 2 without a catalog row. Custom units need `commercial_ledger_custom_units_enabled`. `rate` is a string (major dest per 1 major source). Cliodot does not fetch live FX.

## Analytics

Dedicated ledger surface. Do not use `analytics()` / `analyticsCharts()` for wallet cash — those are subscription MRR.

Needs `commercial_ledger_analytics_enabled`. Runtime scope is `ledger`.

```ts
import {
  CommercialAnalyticsPeriod,
  CommercialAnalyticsGranularity,
  CommercialLedgerTransactionType,
} from "cliodot";

await commercial.ledgerAnalytics({
  period: CommercialAnalyticsPeriod.D30,
  unit: "USD",
  include_all_time: true,
  types: [
    CommercialLedgerTransactionType.Credit,
    CommercialLedgerTransactionType.Debit,
  ],
});
await commercial.ledgerAnalyticsCharts({
  period: CommercialAnalyticsPeriod.D7,
  granularity: CommercialAnalyticsGranularity.Day,
});
```

`include_all_time: true` is optional. Period metrics stay in `summary`; lifetime flow is `all_time` (same `by_unit` movement shape). Omit the flag or pass `false` for period only.

Never sum `by_unit[]` across units. `period_total` is set only when a single unit is in scope. A transfer is one row. Exchange reports from/to separately. Hold capture is not a normal debit.

## Destinations / workflows

Portal destinations subscribe to lifecycle types from `GET /commercial/v1/event-types`. Wallet envelopes:

- `wallet.created` / `wallet.updated` / `wallet.credited` / `wallet.debited`
- `wallet.transferred` / `wallet.reversed` / `wallet.fee_charged` / `wallet.fee_reversed`
- `wallet.settled` / `wallet.voided`
- `wallet.held` / `wallet.captured` / `wallet.released`
- `wallet.exchanged` / `unit.created` / `unit.updated`
- `account.opened` / `account.updated`

Credits facade still emits `credit.purchased` / `credit.drawn`. Filter a destination to `wallet.credited` (or leave `event_types` empty for all). Apps can also call runtime `credit` / `debit` from a workflow — no extra workflow node is required.