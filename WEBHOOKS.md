# Webhooks

Helpers for Cliodot Webhook Apps public receive URLs and outbound destination signature verification.

Webhook Apps are configured in the portal. Providers POST to your tenant domain:

```
https://{tenant-domain}/webhook/{appSlug}/{endpointSlug}
```

## Signature

### Inbound (providers → Cliodot)

Configured per endpoint via verify templates (`stripe`, `paystack`, `cliodot`, `custom`, `none`, …). Verification is performed by the Cliodot API — this SDK does not verify inbound provider signatures.

### Outbound (Cliodot → your URL)

Cliodot signs destination deliveries with:

```
X-Cliodot-Signature: t=<unix>,v1=<hmac-sha256-hex>
```

Signed payload: `{timestamp}.{rawBody}`

## Verify outbound deliveries

```ts
import { verifyCliodotWebhookSignature } from "cliodot";

const ok = verifyCliodotWebhookSignature({
  secret: process.env.WEBHOOK_DESTINATION_SECRET!,
  body: rawBodyString,
  signatureHeader: req.headers["x-cliodot-signature"],
});
```

## Build a public URL

```ts
import { buildWebhookReceiveUrl } from "cliodot";

const url = buildWebhookReceiveUrl({
  domain: "acme.example.com",
  appSlug: "payments",
  endpointSlug: "stripe",
});
```
