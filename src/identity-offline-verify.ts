import crypto from "crypto";
import jwt from "jsonwebtoken";
import { CliodotApiError } from "./errors";
import type {
  IdentityJwks,
  IdentityOfflineVerifyOptions,
} from "./types/identity-app.api";

type JwksCacheEntry = {
  expiresAt: number;
  keys: IdentityJwks["keys"];
};

const jwksCache = new Map<string, JwksCacheEntry>();

function decodeJwtHeader(token: string): { alg?: string; kid?: string } {
  const parts = token.split(".");
  if (parts.length < 2) {
    throw new CliodotApiError("Invalid JWT", { code: "IDENTITY_TOKEN_INVALID" });
  }
  try {
    return JSON.parse(
      Buffer.from(parts[0], "base64url").toString("utf8")
    ) as { alg?: string; kid?: string };
  } catch {
    throw new CliodotApiError("Invalid JWT header", {
      code: "IDENTITY_TOKEN_INVALID",
    });
  }
}

function jwkToPem(jwk: Record<string, string>): string {
  return crypto
    .createPublicKey({ key: jwk as crypto.JsonWebKey, format: "jwk" })
    .export({ type: "spki", format: "pem" })
    .toString();
}

async function loadJwksKeys(
  jwksUrl: string,
  cacheTtlMs: number,
  fetchImpl: typeof fetch
): Promise<IdentityJwks["keys"]> {
  const cached = jwksCache.get(jwksUrl);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.keys;
  }
  const res = await fetchImpl(jwksUrl);
  if (!res.ok) {
    throw new CliodotApiError(`JWKS fetch failed (${res.status})`, {
      status: res.status,
      code: "IDENTITY_JWT_KEYS_NOT_FOUND",
    });
  }
  const body = (await res.json()) as IdentityJwks;
  const keys = body.keys || [];
  jwksCache.set(jwksUrl, {
    keys,
    expiresAt: Date.now() + cacheTtlMs,
  });
  return keys;
}

function pickRs256Key(
  keys: IdentityJwks["keys"],
  kid?: string
): Record<string, string> | undefined {
  if (kid) {
    const match = keys.find((k) => k.kid === kid);
    if (match) return match;
  }
  return keys[0];
}

export function clearIdentityJwksCache(): void {
  jwksCache.clear();
}

export async function verifyIdentityTokenOffline(
  token: string,
  options: IdentityOfflineVerifyOptions
): Promise<Record<string, unknown>> {
  if (!token?.trim()) {
    throw new CliodotApiError("token is required", {
      code: "IDENTITY_TOKEN_INVALID",
    });
  }
  const header = decodeJwtHeader(token.trim());

  if (options.algorithm === "HS256") {
    if (!options.secret?.trim()) {
      throw new CliodotApiError("HS256 verify requires secret");
    }
    try {
      return jwt.verify(token.trim(), options.secret, {
        algorithms: ["HS256"],
      }) as Record<string, unknown>;
    } catch (err: any) {
      if (err?.name === "TokenExpiredError") {
        throw new CliodotApiError("Access token expired", {
          code: "IDENTITY_TOKEN_EXPIRED",
          status: 401,
        });
      }
      throw new CliodotApiError("Invalid access token", {
        code: "IDENTITY_TOKEN_INVALID",
        status: 401,
      });
    }
  }

  const fetchImpl = options.fetch || fetch;
  let publicKeyPem = options.publicKeyPem?.trim();

  if (!publicKeyPem) {
    if (!options.jwksUrl?.trim()) {
      throw new CliodotApiError(
        "RS256 verify requires jwksUrl or publicKeyPem"
      );
    }
    const cacheTtlMs = options.cacheTtlMs ?? 300_000;
    let keys = await loadJwksKeys(
      options.jwksUrl.trim(),
      cacheTtlMs,
      fetchImpl
    );
    let jwk = pickRs256Key(keys, header.kid);
    if (!jwk && header.kid) {
      jwksCache.delete(options.jwksUrl.trim());
      keys = await loadJwksKeys(options.jwksUrl.trim(), cacheTtlMs, fetchImpl);
      jwk = pickRs256Key(keys, header.kid);
    }
    if (!jwk) {
      throw new CliodotApiError("No matching JWKS key", {
        code: "IDENTITY_JWT_KEYS_NOT_FOUND",
        status: 401,
      });
    }
    publicKeyPem = jwkToPem(jwk);
  }

  try {
    return jwt.verify(token.trim(), publicKeyPem, {
      algorithms: ["RS256"],
    }) as Record<string, unknown>;
  } catch (err: any) {
    if (err?.name === "TokenExpiredError") {
      throw new CliodotApiError("Access token expired", {
        code: "IDENTITY_TOKEN_EXPIRED",
        status: 401,
      });
    }
    throw new CliodotApiError("Invalid access token", {
      code: "IDENTITY_TOKEN_INVALID",
      status: 401,
    });
  }
}

export function parseIdentityScopeClaim(
  tokenOrClaims: string | Record<string, unknown>
): string[] {
  let claims: Record<string, unknown>;
  if (typeof tokenOrClaims === "string") {
    const parts = tokenOrClaims.split(".");
    if (parts.length < 2) return [];
    try {
      claims = JSON.parse(
        Buffer.from(parts[1], "base64url").toString("utf8")
      ) as Record<string, unknown>;
    } catch {
      return [];
    }
  } else {
    claims = tokenOrClaims;
  }
  const raw = claims.scope;
  if (Array.isArray(raw)) {
    return [...new Set(raw.map(String).map((s) => s.trim()).filter(Boolean))];
  }
  if (typeof raw === "string") {
    return [
      ...new Set(
        raw
          .split(/[\s,]+/)
          .map((s) => s.trim())
          .filter(Boolean)
      ),
    ];
  }
  return [];
}

export function tokenHasScopes(
  tokenOrClaims: string | Record<string, unknown>,
  required: string[]
): boolean {
  const have = new Set(parseIdentityScopeClaim(tokenOrClaims));
  for (const name of required || []) {
    const n = String(name || "").trim();
    if (!n) continue;
    if (!have.has(n)) return false;
  }
  return true;
}
