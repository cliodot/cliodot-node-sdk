# Typed Connector End-to-End Samples

This guide shows how to build and use typed connectors with real examples.

## Why typed connectors are needed

Without typed connectors, connector calls are usually `string + any`:

- Action names can be misspelled and fail only at runtime.
- Request payload shape (`body`, `params`, `pathParams`, `headers`) is not validated by TypeScript.
- Response shape is unknown, so downstream workflow code (or `ctx.input`) has weak IntelliSense.
- Teams duplicate implicit API contracts across files and docs.

Typed connectors solve this by making the connector contract explicit in one place and reusable everywhere.

## What a typed connector gives you

When you call `defineTypedConnector(...)`, you get:

- A stable connector identifier (`id`).
- Action keys with autocomplete (`actions` + typed key overloads).
- A schema map (`__schemas`) used by helper types.
- Strong typing across:
  - `@Connector(...)` decorator config
  - `s.connector(...)` builder config
  - `flosync.runConnector(...)` options
  - type extraction helpers like `ConnectorResponse<...>`

## How it works (compile-time vs runtime)

Typed connectors are primarily a TypeScript feature:

- **Compile-time**
  - TypeScript checks that the action key exists.
  - TypeScript checks config shape for `body`, `params`, `pathParams`, `headers`, `vars`.
  - TypeScript infers response type helpers.
- **Runtime**
  - The runner still executes regular connector actions by `connectorId + action`.
  - Schemas are not runtime validators by default.
  - Templates (`"{{ ... }}"`) still work and are intentionally allowed in typed fields.

Think of typed connectors as a contract layer over the existing execution engine.

## Schema field semantics

- `body`: request payload body
- `params`: query string parameters
- `pathParams`: path replacements (for `:id`, `:reference`, etc.)
- `headers`: request headers
- `vars`: step-scoped values merged into workflow vars before execution
- `response`: expected result shape for typing and editor support

## Recommended usage pattern

1. Define connector schema once near the connector.
2. Use typed action key style in workflows: `@Connector(Paystack, "initializeTransaction", ...)`.
3. Use `satisfies ConnectorTypedRequestConfig<...>` for request config objects.
4. Use `ConnectorResponse<...>` (or related helpers) when annotating step output contexts.
5. Keep schema close to real provider docs and update it when provider contracts change.

## 1) Define a typed connector

```typescript
import { defineTypedConnector } from "@cliodot/flosync";

export const Paystack = defineTypedConnector(
  "paystack",
  {
    initializeTransaction: "initializeTransaction",
    verifyTransaction: "verifyTransaction",
  },
  {
    initializeTransaction: {
      body: {} as {
        email: string;
        amount: number;
        reference?: string;
        callback_url?: string;
      },
      headers: {} as {
        "Idempotency-Key"?: string;
      },
      vars: {} as {
        traceId?: string;
      },
      response: {} as {
        status: boolean;
        message: string;
        data: {
          authorization_url: string;
          access_code: string;
          reference: string;
        };
      },
    },
    verifyTransaction: {
      pathParams: {} as { reference: string },
      response: {} as {
        status: boolean;
        message: string;
        data: {
          id: number;
          status: string;
          reference: string;
          amount: number;
          currency: string;
          paid_at: string | null;
        };
      },
    },
  }
);
```

## 2) Extract strongly typed request/response helpers

```typescript
import type {
  ConnectorBody,
  ConnectorHeaders,
  ConnectorPathParams,
  ConnectorResponse,
  ConnectorTypedRequestConfig,
  ConnectorVars,
} from "@cliodot/flosync";

type InitBody = ConnectorBody<typeof Paystack, "initializeTransaction">;
type InitHeaders = ConnectorHeaders<typeof Paystack, "initializeTransaction">;
type InitVars = ConnectorVars<typeof Paystack, "initializeTransaction">;
type VerifyPath = ConnectorPathParams<typeof Paystack, "verifyTransaction">;
type InitResponse = ConnectorResponse<typeof Paystack, "initializeTransaction">;

type InitConfig = ConnectorTypedRequestConfig<typeof Paystack, "initializeTransaction">;
```

## 3) Use it in decorator workflows

```typescript
import {
  Workflow,
  Http,
  Connector,
  Responder,
  Validator,
  variable as v,
} from "@cliodot/flosync";
import type {
  ConnectorTypedRequestConfig,
  ConnectorResponse,
} from "@cliodot/flosync";
import { Paystack } from "../connectors/paystack.connector";

type InitializePaymentRequest = ConnectorTypedRequestConfig<
  typeof Paystack,
  "initializeTransaction"
>;
type InitializePaymentResponse = ConnectorResponse<
  typeof Paystack,
  "initializeTransaction"
>;

@Workflow("payment-initialize", "Initialize Payment")
@Http("POST", "/payment/initialize")
export class PaymentInitializeWorkflow {
  @Validator(
    [
      {
        fields: [v.body("email")],
        validators: [{ name: "required" }, { name: "is_email" }],
      },
      {
        fields: [v.body("amount")],
        validators: [{ name: "required" }],
      },
    ],
    { order: 0, then: "generateReference", else: "invalid" }
  )
  validate() {}

  @Responder(
    "json",
    {
      statusCode: 400,
      body: {
        ok: false,
        message: "Validation failed",
        errors: v.stepResult("validate", "errors"),
      },
    },
    { order: 1 }
  )
  invalid() {}

  @Connector("utility.random", "random_uuid", {}, { order: 2 })
  generateReference() {}

  @Connector(
    Paystack,
    "initializeTransaction",
    {
      body: {
        email: v.body("email"),
        amount: v.body("amount"),
        reference: v.stepResult("generateReference", "value"),
      },
      headers: {
        "Idempotency-Key": v.stepResult("generateReference", "value"),
      },
      vars: {
        traceId: v.stepResult("generateReference", "value"),
      },
    } satisfies InitializePaymentRequest,
    { order: 3, then: "respond", else: "initError" }
  )
  initialize() {}

  @Responder(
    "json",
    {
      body: {
        message: "Payment initialized successfully",
        data: v.stepResult("initialize") as unknown as InitializePaymentResponse,
      },
    },
    { order: 4 }
  )
  respond() {}

  @Responder(
    "json",
    {
      statusCode: 400,
      body: {
        message: "Payment initialization failed",
        data: v.stepResult("initialize"),
      },
    },
    { order: 5 }
  )
  initError() {}
}
```

## 4) Use it in builder-style workflows

```typescript
import { flosync, variable as v } from "@cliodot/flosync";
import { Paystack } from "../connectors/paystack.connector";

const workflow = flosync
  .workflow("payment-verify", "Verify Payment")
  .http("GET", "/payment/verify/:reference")
  .step("verify", (s) =>
    s.connector(Paystack, "verifyTransaction", {
      pathParams: { reference: v.pathParam("reference") },
    })
  )
  .step("respond", (s) =>
    s.responder("json", {
      body: {
        message: "Payment verified successfully",
        data: v.stepResult("verify"),
      },
    })
  )
  .build();
```

## 5) Use it in direct connector execution

```typescript
import { flosync } from "@cliodot/flosync";
import { Paystack } from "../connectors/paystack.connector";

const result = await flosync.runConnector(
  Paystack,
  "verifyTransaction",
  {
    pathParams: { reference: "ref_123" },
  },
  { remote: true }
);
```

## Notes

- Typed connectors support both usage styles:
  - Typed style: `@Connector(Paystack, "initializeTransaction", ...)`
  - Classic style: `@Connector(Paystack.id, Paystack.actions.initializeTransaction, ...)`
- Template expressions are supported in typed request fields (`body`, `params`, `pathParams`, `headers`, `vars`).
- Use `satisfies ConnectorTypedRequestConfig<...>` to enforce shape while keeping expression values.

## Common pitfalls and fixes

- **Using action value instead of action key**
  - Use `"initializeTransaction"` (the key), not a random string.
- **Expecting schema to validate runtime payloads**
  - Schema gives TypeScript safety; add validator steps if you need runtime validation.
- **Forgetting optional fields in provider responses**
  - Mark uncertain fields as optional in `response` to avoid brittle assumptions.
- **Mixing classic and typed style inconsistently**
  - Prefer typed style for new workflows; keep classic only where migration is pending.

## Migration strategy for existing workflows

For each connector/action pair:

1. Introduce a typed connector definition with current contract.
2. Replace `@Connector("id", "action", config)` with `@Connector(TypedDef, "actionKey", config)`.
3. Add `satisfies ConnectorTypedRequestConfig<...>` to the config object.
4. Add response helper types only where they improve readability (avoid over-annotating everything).
5. Run typecheck and fix mismatches surfaced by TypeScript.
