import axios from "axios";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { IdentityAppClient } from "../IdentityAppClient";
import { CliodotApiError } from "../errors";
import {
  clearIdentityJwksCache,
  tokenHasScopes,
  verifyIdentityTokenOffline,
} from "../identity-offline-verify";
import { createIdentityTokenCache } from "../identity-token-cache";

jest.mock("axios");
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe("IdentityAppClient", () => {
  const mockAxiosInstance = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockedAxios.create.mockReturnValue(mockAxiosInstance as any);
  });

  function createClient(
    overrides?: Partial<ConstructorParameters<typeof IdentityAppClient>[0]>
  ) {
    return new IdentityAppClient({
      baseUrl: "https://api.example.com",
      appId: "identity_payroll",
      appApiKey: "iak_test_key",
      ...overrides,
    });
  }

  it("requires baseUrl and appId", () => {
    expect(
      () => new IdentityAppClient({ baseUrl: "", appId: "identity_payroll" })
    ).toThrow(CliodotApiError);
    expect(
      () =>
        new IdentityAppClient({
          baseUrl: "https://api.example.com",
          appId: "",
        })
    ).toThrow(CliodotApiError);
  });

  it("authenticates with bearer api key", async () => {
    mockAxiosInstance.mockResolvedValue({
      data: {
        ok: true,
        access_token: "jwt",
        token_type: "Bearer",
        expires_in: 3600,
        caller_app_id: "identity_payroll",
        target_app_id: "identity_hrms",
      },
    });
    const client = createClient();
    const result = await client.authenticate({
      target_app_id: "identity_hrms",
    });
    expect(result.access_token).toBe("jwt");
    expect(mockAxiosInstance).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "POST",
        url: "/v1/authenticate",
        headers: {
          "x-cliodot-app-id": "identity_payroll",
          Authorization: "Bearer iak_test_key",
        },
        data: { target_app_id: "identity_hrms" },
      })
    );
  });

  it("authenticate and verify pass scopes", async () => {
    mockAxiosInstance.mockResolvedValue({
      data: {
        ok: true,
        access_token: "jwt",
        token_type: "Bearer",
        expires_in: 3600,
        caller_app_id: "identity_payroll",
        target_app_id: "identity_hrms",
      },
    });
    const client = createClient();
    await client.authenticate({
      target_app_id: "identity_hrms",
      scopes: ["employees.read"],
    });
    expect(mockAxiosInstance).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          target_app_id: "identity_hrms",
          scopes: ["employees.read"],
        },
      })
    );
    mockAxiosInstance.mockResolvedValue({
      data: {
        ok: true,
        valid: true,
        jti: "j1",
        caller_app_id: "identity_payroll",
        target_app_id: "identity_hrms",
        expires_at: new Date().toISOString(),
        claims: { scope: "employees.read" },
      },
    });
    await client.verify({
      access_token: "jwt",
      required_scopes: ["employees.read"],
    });
    expect(mockAxiosInstance).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          access_token: "jwt",
          required_scopes: ["employees.read"],
        },
      })
    );
  });

  it("uses app secret headers when no api key", async () => {
    mockAxiosInstance.mockResolvedValue({
      data: {
        ok: true,
        app: {
          _id: "identity_payroll",
          name: "Payroll",
          slug: "identity_payroll",
          tenant_id: "t1",
          status: "active",
        },
      },
    });
    const client = createClient({
      appApiKey: undefined,
      appSecret: "secret_hex",
    });
    await client.me();
    expect(mockAxiosInstance).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "GET",
        url: "/v1/me",
        headers: {
          "x-cliodot-app-id": "identity_payroll",
          "x-cliodot-app-secret": "secret_hex",
        },
      })
    );
  });

  it("maps API error codes", async () => {
    mockAxiosInstance.mockResolvedValue({
      data: {
        ok: false,
        error: "Target app does not trust the caller",
        code: "IDENTITY_TRUST_DENIED",
      },
    });
    const client = createClient();
    await expect(
      client.authenticate({ target_app_id: "identity_hrms" })
    ).rejects.toMatchObject({
      code: "IDENTITY_TRUST_DENIED",
    });
  });

  it("fetches JWKS without auth headers", async () => {
    mockAxiosInstance.mockResolvedValue({
      data: { keys: [{ kid: "k1", kty: "RSA" }] },
    });
    const client = createClient();
    const jwks = await client.getJwks("identity_hrms");
    expect(jwks.keys[0].kid).toBe("k1");
    expect(mockAxiosInstance).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "GET",
        url: "/v1/apps/identity_hrms/jwks.json",
      })
    );
  });
});

describe("verifyIdentityTokenOffline", () => {
  beforeEach(() => {
    clearIdentityJwksCache();
  });

  it("verifies HS256 tokens", async () => {
    const secret = "ijwt_test_secret_value_1234567890";
    const token = jwt.sign(
      { sub: "identity_payroll", jti: "j1", exp: Math.floor(Date.now() / 1000) + 60 },
      secret,
      { algorithm: "HS256", noTimestamp: true }
    );
    const claims = await verifyIdentityTokenOffline(token, {
      algorithm: "HS256",
      secret,
    });
    expect(claims.jti).toBe("j1");
  });

  it("verifies RS256 via JWKS kid", async () => {
    const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
      modulusLength: 2048,
      publicKeyEncoding: { type: "spki", format: "pem" },
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
    });
    const jwk = crypto
      .createPublicKey(publicKey)
      .export({ format: "jwk" }) as { n?: string; e?: string; kty?: string };
    const token = jwt.sign(
      { sub: "identity_payroll", jti: "j2", exp: Math.floor(Date.now() / 1000) + 60 },
      privateKey,
      { algorithm: "RS256", keyid: "kid_1", noTimestamp: true }
    );

    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        keys: [
          {
            kty: jwk.kty || "RSA",
            kid: "kid_1",
            n: jwk.n!,
            e: jwk.e!,
            alg: "RS256",
            use: "sig",
          },
        ],
      }),
    });

    const claims = await verifyIdentityTokenOffline(token, {
      algorithm: "RS256",
      jwksUrl: "https://api.example.com/identity/v1/apps/identity_hrms/jwks.json",
      fetch: fetchImpl as any,
    });
    expect(claims.jti).toBe("j2");
    expect(fetchImpl).toHaveBeenCalled();
  });

  it("tokenHasScopes checks JWT scope claim", () => {
    const token = jwt.sign(
      { scope: "employees.read employees.write", jti: "j" },
      "secret",
      { algorithm: "HS256", noTimestamp: true }
    );
    expect(tokenHasScopes(token, ["employees.read"])).toBe(true);
    expect(tokenHasScopes(token, ["employees.admin"])).toBe(false);
  });
});

describe("createIdentityTokenCache", () => {
  it("authenticates then reuses until near expiry", async () => {
    const authenticate = jest.fn().mockResolvedValue({
      ok: true,
      access_token: "at_1",
      token_type: "Bearer",
      expires_in: 3600,
      refresh_token: "irt_1",
      caller_app_id: "identity_payroll",
      target_app_id: "identity_hrms",
    });
    const refresh = jest.fn();
    const cache = createIdentityTokenCache({
      client: { authenticate, refresh },
    });
    const first = await cache.getAccessToken("identity_hrms");
    const second = await cache.getAccessToken("identity_hrms");
    expect(first).toBe("at_1");
    expect(second).toBe("at_1");
    expect(authenticate).toHaveBeenCalledTimes(1);
  });
});
