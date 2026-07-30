import crypto from "crypto";

export type WebhooksConfig = {
  domain: string;
  appSlug: string;
  endpointSlug: string;
  scheme?: "http" | "https";
};

export function buildWebhookReceiveUrl(config: WebhooksConfig): string {
  const domain = config.domain.trim().replace(/^https?:\/\//, "").split("/")[0];
  const appSlug = config.appSlug.trim().toLowerCase();
  const endpointSlug = config.endpointSlug.trim().toLowerCase();
  const scheme = config.scheme || "https";
  return `${scheme}://${domain}/webhook/${appSlug}/${endpointSlug}`;
}

export function signCliodotWebhookPayload(
  secret: string,
  timestamp: number,
  body: string
): string {
  const digest = crypto
    .createHmac("sha256", secret)
    .update(`${timestamp}.${body}`)
    .digest("hex");
  return `t=${timestamp},v1=${digest}`;
}

export function verifyCliodotWebhookSignature(input: {
  secret: string;
  body: string;
  signatureHeader: string | string[] | undefined;
  toleranceSeconds?: number;
}): boolean {
  const header = Array.isArray(input.signatureHeader)
    ? input.signatureHeader[0]
    : input.signatureHeader;
  if (!header) return false;

  const parts = header.split(",").map((p) => p.trim());
  let timestamp: number | undefined;
  let v1: string | undefined;
  for (const part of parts) {
    const [k, v] = part.split("=");
    if (k === "t" && v) timestamp = Number(v);
    if (k === "v1" && v) v1 = v;
  }
  if (!timestamp || !v1 || Number.isNaN(timestamp)) return false;

  const tolerance = input.toleranceSeconds ?? 300;
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - timestamp) > tolerance) return false;

  const expected = signCliodotWebhookPayload(
    input.secret,
    timestamp,
    input.body
  );
  const expectedDigest = expected.split("v1=")[1];
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expectedDigest, "hex"),
      Buffer.from(v1, "hex")
    );
  } catch {
    return false;
  }
}

export class Webhooks {
  static buildReceiveUrl = buildWebhookReceiveUrl;
  static sign = signCliodotWebhookPayload;
  static verify = verifyCliodotWebhookSignature;
}
