import axios from "axios";
import { OAuthAppClient } from "../OAuthAppClient";
import { CliodotApiError } from "../errors";
import { OAuthConnectionStorage } from "../types/oauth-app.api";

jest.mock("axios");
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe("OAuthAppClient", () => {
  const mockAxiosInstance = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockedAxios.create.mockReturnValue(mockAxiosInstance as any);
  });

  function createClient(overrides?: Partial<ConstructorParameters<typeof OAuthAppClient>[0]>) {
    return new OAuthAppClient({
      baseUrl: "https://api.example.com",
      appId: "oauth_app_test",
      appApiKey: "oak_test_key",
      ...overrides,
    });
  }

  it("requires baseUrl and appId", () => {
    expect(() => new OAuthAppClient({ baseUrl: "", appId: "oauth_app_test" })).toThrow(
      CliodotApiError
    );
    expect(() => new OAuthAppClient({ baseUrl: "https://api.example.com", appId: "" })).toThrow(
      CliodotApiError
    );
  });

  it("builds connect URL with query params", () => {
    const client = createClient();
    const url = client.connect.buildUrl({
      provider: "google",
      redirect_uri: "https://app.example.com/callback",
      scopes: ["openid", "email"],
      state: "csrf",
      external_user_id: "user_1",
      connection_storage: OAuthConnectionStorage.EPHEMERAL,
    });
    expect(url).toBe(
      "https://api.example.com/oauth/apps/oauth_app_test/connect?provider=google&redirect_uri=https%3A%2F%2Fapp.example.com%2Fcallback&scope=openid+email&state=csrf&external_user_id=user_1&connection_storage=ephemeral"
    );
  });

  it("starts connect without S2S auth headers", async () => {
    mockAxiosInstance.mockResolvedValue({
      data: {
        ok: true,
        grant_type: "authorization_code",
        authorization_url: "https://accounts.google.com/o/oauth2/v2/auth?...",
      },
    });
    const client = createClient();
    const result = await client.connect.start({
      provider: "google",
      redirect_uri: "https://app.example.com/callback",
    });
    expect(result.authorization_url).toContain("accounts.google.com");
    expect(mockAxiosInstance).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "POST",
        url: "/apps/oauth_app_test/connect",
        headers: {},
        data: {
          provider: "google",
          redirect_uri: "https://app.example.com/callback",
        },
      })
    );
  });

  it("uses Bearer appApiKey for S2S requests", async () => {
    mockAxiosInstance.mockResolvedValue({
      data: { ok: true, connection: { id: "conn_1" } },
    });
    const client = createClient({ appApiKey: "oak_abc" });
    await client.connections.get("conn_1");
    expect(mockAxiosInstance).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "GET",
        url: "/connections/conn_1",
        headers: { Authorization: "Bearer oak_abc" },
      })
    );
  });

  it("uses app id + secret headers when no api key", async () => {
    mockAxiosInstance.mockResolvedValue({
      data: { ok: true, connection: { id: "conn_1" } },
    });
    const client = createClient({
      appApiKey: undefined,
      appSecret: "secret_abc",
    });
    await client.connections.get("conn_1");
    expect(mockAxiosInstance).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: {
          "X-Cliodot-App-Id": "oauth_app_test",
          "X-Cliodot-App-Secret": "secret_abc",
        },
      })
    );
  });

  it("throws when S2S called without credentials", async () => {
    const client = createClient({ appApiKey: undefined, appSecret: undefined });
    await expect(client.exchange({ code: "ex_1", connection_id: "conn_1" })).rejects.toThrow(
      "OAuth app credentials required"
    );
  });

  it("exchanges token with correct path and body", async () => {
    mockAxiosInstance.mockResolvedValue({
      data: {
        ok: true,
        connection: { id: "conn_1", provider: "google", status: "active" },
      },
    });
    const client = createClient();
    const result = await client.exchange({ code: "ex_code", connection_id: "conn_1" });
    expect(result.connection.id).toBe("conn_1");
    expect(mockAxiosInstance).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "POST",
        url: "/token/exchange",
        data: { code: "ex_code", connection_id: "conn_1" },
      })
    );
  });

  it("maps connections.refresh and connections.revoke", async () => {
    mockAxiosInstance
      .mockResolvedValueOnce({
        data: {
          ok: true,
          connection: { id: "conn_1" },
          access_token: "ya29.new",
        },
      })
      .mockResolvedValueOnce({ data: { ok: true, revoked: true } });

    const client = createClient();
    const refreshed = await client.connections.refresh("conn_1");
    expect(refreshed.access_token).toBe("ya29.new");
    expect(mockAxiosInstance).toHaveBeenCalledWith(
      expect.objectContaining({ method: "POST", url: "/connections/conn_1/refresh" })
    );

    const revoked = await client.connections.revoke("conn_1", { reason: "user left" });
    expect(revoked.revoked).toBe(true);
    expect(mockAxiosInstance).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "POST",
        url: "/connections/conn_1/revoke",
        data: { reason: "user left" },
      })
    );
  });

  it("sync aliases getToken", async () => {
    mockAxiosInstance.mockResolvedValue({
      data: { ok: true, access_token: "ya29.sync", token_type: "Bearer" },
    });
    const client = createClient();
    const result = await client.connections.sync("conn_1");
    expect(result.access_token).toBe("ya29.sync");
    expect(mockAxiosInstance).toHaveBeenCalledWith(
      expect.objectContaining({ method: "GET", url: "/connections/conn_1/token" })
    );
  });

  it("parses API error responses", async () => {
    mockAxiosInstance.mockRejectedValue({
      response: {
        status: 400,
        data: { ok: false, error: "Invalid or expired exchange code", code: "OAUTH_EXCHANGE_CODE_INVALID" },
      },
    });
    const client = createClient();
    await expect(client.exchange({ code: "bad", connection_id: "conn_1" })).rejects.toMatchObject({
      message: "Invalid or expired exchange code",
      status: 400,
      code: "OAUTH_EXCHANGE_CODE_INVALID",
    });
  });

  it("parses API error responses with nested error object", async () => {
    mockAxiosInstance.mockRejectedValue({
      response: {
        status: 422,
        data: {
          message: "No refresh token available for this connection",
          status: false,
          statusCode: 422,
          data: null,
          error: { statusCode: 422, code: "OAUTH_PROVIDER_ERROR" },
        },
      },
    });
    const client = createClient();
    await expect(client.connections.getToken("conn_1")).rejects.toMatchObject({
      message: "No refresh token available for this connection",
      status: 422,
      code: "OAUTH_PROVIDER_ERROR",
    });
  });

  it("starts SAML connect and builds POST form fields", async () => {
    mockAxiosInstance.mockResolvedValue({
      data: {
        ok: true,
        protocol: "saml",
        authorization_url: "https://idp.example.com/sso",
        sso_binding: "post",
        saml_request: "PHNhbWxwOlJlcXVlc3Q...",
        relay_state: "relay-123",
      },
    });
    const client = createClient();
    const result = await client.connect.start({
      provider: "google-sso",
      redirect_uri: "https://app.example.com/callback",
    });
    expect(result.protocol).toBe("saml");
    expect(client.connect.isSamlPostBinding(result)).toBe(true);
    expect(client.connect.buildSamlPostForm(result)).toEqual({
      action: "https://idp.example.com/sso",
      samlRequest: "PHNhbWxwOlJlcXVlc3Q...",
      relayState: "relay-123",
    });
  });

  it("returns SAML session fields from exchange", async () => {
    mockAxiosInstance.mockResolvedValue({
      data: {
        ok: true,
        protocol: "saml",
        connection: {
          id: "conn_saml",
          provider: "google-sso",
          protocol: "saml",
          status: "active",
        },
        name_id: "user@example.com",
        saml_attributes: { email: "user@example.com", role: "admin" },
      },
    });
    const client = createClient();
    const result = await client.exchange({ code: "ex_code", connection_id: "conn_saml" });
    expect(result.protocol).toBe("saml");
    expect(result.name_id).toBe("user@example.com");
    expect(result.saml_attributes).toEqual({ email: "user@example.com", role: "admin" });
  });

  it("creates axios client with /oauth base URL", () => {
    createClient({ baseUrl: "https://api.example.com/" });
    expect(mockedAxios.create).toHaveBeenCalledWith(
      expect.objectContaining({
        baseURL: "https://api.example.com/oauth",
      })
    );
  });

  it("starts immediate client_credentials connect", async () => {
    mockAxiosInstance.mockResolvedValue({
      data: {
        ok: true,
        protocol: "oauth2",
        grant_type: "client_credentials",
        exchange_code: "ex_immediate",
        connection_id: "conn_immediate",
        redirect_url: "https://app.example.com/callback?code=ex_immediate&connection_id=conn_immediate",
      },
    });
    const client = createClient();
    const result = await client.connect.start({
      provider: "m2m",
      redirect_uri: "https://app.example.com/callback",
    });
    expect(result.exchange_code).toBe("ex_immediate");
    expect(result.connection_id).toBe("conn_immediate");
  });

  it("polls device connect until complete", async () => {
    mockAxiosInstance
      .mockRejectedValueOnce({
        response: {
          status: 428,
          data: { ok: false, error: "authorization_pending", code: "OAUTH_PROVIDER_ERROR" },
        },
      })
      .mockResolvedValueOnce({
        data: {
          ok: true,
          grant_type: "urn:ietf:params:oauth:grant-type:device_code",
          exchange_code: "ex_device",
          connection_id: "conn_device",
        },
      });

    const client = createClient();
    const result = await client.connect.poll({
      provider: "tv-app",
      poll_state: "poll-state-1",
      pollIntervalMs: 1,
    });
    expect(result.exchange_code).toBe("ex_device");
    expect(mockAxiosInstance).toHaveBeenCalledTimes(2);
    expect(mockAxiosInstance).toHaveBeenLastCalledWith(
      expect.objectContaining({
        method: "POST",
        url: "/apps/oauth_app_test/connect/poll",
        data: { provider: "tv-app", poll_state: "poll-state-1" },
      })
    );
  });

  it("passes assertion grants on connect start", async () => {
    mockAxiosInstance.mockResolvedValue({
      data: {
        ok: true,
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        exchange_code: "ex_jwt",
        connection_id: "conn_jwt",
      },
    });
    const client = createClient();
    await client.connect.start({
      provider: "m2m-api",
      redirect_uri: "https://app.example.com/callback",
      assertion: "eyJ.assertion",
    });
    expect(mockAxiosInstance).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          assertion: "eyJ.assertion",
        }),
      })
    );
  });
});
