import axios, { AxiosInstance } from "axios";
import { CliodotApiError, cliodotApiErrorFromAxios } from "./errors";
import { parseApiErrorCode, parseApiErrorMessage } from "./http/parse-api-error";
import type {
  OAuthAppClientConfig,
  OAuthConnectApi,
  OAuthConnectPollInput,
  OAuthConnectPollResponse,
  OAuthConnectStartInput,
  OAuthConnectStartResponse,
  OAuthConnectionResponse,
  OAuthConnectionWithTokenResponse,
  OAuthConnectionsApi,
  OAuthDeleteResponse,
  OAuthExchangeInput,
  OAuthExchangeResponse,
  OAuthRevokeInput,
  OAuthRevokeResponse,
  OAuthSamlPostForm,
  OAuthTokenResponse,
} from "./types/oauth-app.api";
import { isDeviceAuthorizationPendingError } from "./types/oauth-app.api";

function trimBaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

function resolveScope(input: OAuthConnectStartInput): string | undefined {
  if (input.scope?.trim()) {
    return input.scope.trim();
  }
  if (input.scopes?.length) {
    return input.scopes.filter(Boolean).join(" ");
  }
  return undefined;
}

function buildConnectQuery(input: OAuthConnectStartInput): Record<string, string> {
  const query: Record<string, string> = {
    provider: input.provider.trim(),
    redirect_uri: input.redirect_uri.trim(),
  };
  const scope = resolveScope(input);
  if (scope) query.scope = scope;
  if (input.state) query.state = input.state;
  if (input.external_user_id) query.external_user_id = input.external_user_id;
  if (input.connection_storage) query.connection_storage = input.connection_storage;
  return query;
}

function buildConnectBody(input: OAuthConnectStartInput): Record<string, unknown> {
  const body: Record<string, unknown> = {
    provider: input.provider.trim(),
    redirect_uri: input.redirect_uri.trim(),
  };
  const scope = resolveScope(input);
  if (scope) body.scope = scope;
  if (input.scopes?.length) body.scopes = input.scopes;
  if (input.state) body.state = input.state;
  if (input.external_user_id) body.external_user_id = input.external_user_id;
  if (input.connection_storage) body.connection_storage = input.connection_storage;
  if (input.assertion) body.assertion = input.assertion;
  if (input.subject_token) body.subject_token = input.subject_token;
  if (input.subject_token_type) body.subject_token_type = input.subject_token_type;
  if (input.requested_token_type) body.requested_token_type = input.requested_token_type;
  if (input.actor_token) body.actor_token = input.actor_token;
  if (input.actor_token_type) body.actor_token_type = input.actor_token_type;
  if (input.audience) body.audience = input.audience;
  return body;
}

function assertConnectInput(input: OAuthConnectStartInput): void {
  if (!input.provider?.trim()) {
    throw new CliodotApiError("connect requires provider");
  }
  if (!input.redirect_uri?.trim()) {
    throw new CliodotApiError("connect requires redirect_uri");
  }
}

function assertPollInput(input: OAuthConnectPollInput): void {
  if (!input.provider?.trim()) {
    throw new CliodotApiError("poll requires provider");
  }
  if (!input.poll_state?.trim()) {
    throw new CliodotApiError("poll requires poll_state");
  }
}

function assertExchangeInput(input: OAuthExchangeInput): void {
  if (!input.code?.trim()) {
    throw new CliodotApiError("exchange requires code");
  }
  if (!input.connection_id?.trim()) {
    throw new CliodotApiError("exchange requires connection_id");
  }
}

function assertConnectionId(connectionId: string): void {
  if (!connectionId?.trim()) {
    throw new CliodotApiError("connectionId is required");
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class OAuthAppClient {
  private readonly baseUrl: string;
  private readonly appId: string;
  private readonly appApiKey?: string;
  private readonly appSecret?: string;
  private readonly axios: AxiosInstance;
  public readonly debug: boolean;

  constructor(config: OAuthAppClientConfig) {
    if (!config.baseUrl?.trim()) {
      throw new CliodotApiError("OAuthAppClient requires baseUrl");
    }
    if (!config.appId?.trim()) {
      throw new CliodotApiError("OAuthAppClient requires appId");
    }
    this.baseUrl = trimBaseUrl(config.baseUrl);
    this.appId = config.appId.trim();
    this.appApiKey = config.appApiKey?.trim() || undefined;
    this.appSecret = config.appSecret?.trim() || undefined;
    this.debug = config.debug ?? false;
    this.axios = axios.create({
      baseURL: `${this.baseUrl}/oauth`,
      timeout: 30000,
      headers: { "Content-Type": "application/json" },
    });
  }

  private resolveAppId(appId?: string): string {
    return (appId?.trim() || this.appId).trim();
  }

  private buildS2SHeaders(): Record<string, string> {
    if (this.appApiKey) {
      return { Authorization: `Bearer ${this.appApiKey}` };
    }
    if (this.appSecret) {
      return {
        "X-Cliodot-App-Id": this.appId,
        "X-Cliodot-App-Secret": this.appSecret,
      };
    }
    throw new CliodotApiError("OAuth app credentials required (appApiKey or appSecret)");
  }

  private async request<T>(
    method: string,
    path: string,
    options?: {
      body?: Record<string, unknown>;
      params?: Record<string, string>;
      auth?: boolean;
      validateResponse?: boolean;
    }
  ): Promise<T> {
    const headers: Record<string, string> = {};
    if (options?.auth !== false) {
      Object.assign(headers, this.buildS2SHeaders());
    }
    try {
      const { data } = await this.axios({
        method,
        url: path,
        headers,
        data: options?.body,
        params: options?.params,
        validateStatus:
          options?.validateResponse === false
            ? (status) => status < 500
            : undefined,
      });
      if (data?.ok === false) {
        const status = (data as { statusCode?: number }).statusCode;
        throw new CliodotApiError(
          parseApiErrorMessage(data) || "OAuth request failed",
          {
            data,
            code: parseApiErrorCode(data),
            status: status === 428 ? 428 : undefined,
          }
        );
      }
      return data as T;
    } catch (err: any) {
      if (err instanceof CliodotApiError) {
        throw err;
      }
      const apiErr = cliodotApiErrorFromAxios(err, `Request failed: ${method} ${path}`);
      throw apiErr;
    }
  }

  readonly connect: OAuthConnectApi = {
    start: async (input: OAuthConnectStartInput): Promise<OAuthConnectStartResponse> => {
      assertConnectInput(input);
      const appId = this.resolveAppId(input.appId);
      return this.request<OAuthConnectStartResponse>(
        "POST",
        `/apps/${encodeURIComponent(appId)}/connect`,
        { body: buildConnectBody(input), auth: false }
      );
    },

    poll: async (input: OAuthConnectPollInput): Promise<OAuthConnectPollResponse> => {
      assertPollInput(input);
      const appId = this.resolveAppId(input.appId);
      const intervalMs = input.pollIntervalMs ?? 5000;
      const maxAttempts = input.maxAttempts ?? 120;

      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        try {
          return await this.request<OAuthConnectPollResponse>(
            "POST",
            `/apps/${encodeURIComponent(appId)}/connect/poll`,
            {
              body: {
                provider: input.provider.trim(),
                poll_state: input.poll_state.trim(),
              },
              auth: false,
            }
          );
        } catch (err) {
          if (!isDeviceAuthorizationPendingError(err) || attempt === maxAttempts - 1) {
            throw err;
          }
          await sleep(intervalMs);
        }
      }

      throw new CliodotApiError("Device authorization poll timed out");
    },

    buildUrl: (input: OAuthConnectStartInput): string => {
      assertConnectInput(input);
      const appId = this.resolveAppId(input.appId);
      const url = new URL(`${this.baseUrl}/oauth/apps/${encodeURIComponent(appId)}/connect`);
      const query = buildConnectQuery(input);
      for (const [key, value] of Object.entries(query)) {
        url.searchParams.set(key, value);
      }
      return url.toString();
    },

    isSamlPostBinding: (response: OAuthConnectStartResponse): boolean => {
      return response.sso_binding === "post" && !!response.saml_request && !!response.relay_state;
    },

    buildSamlPostForm: (response: OAuthConnectStartResponse): OAuthSamlPostForm | null => {
      if (!response.saml_request || !response.relay_state || !response.authorization_url) {
        return null;
      }
      if (response.sso_binding && response.sso_binding !== "post") {
        return null;
      }
      return {
        action: response.authorization_url,
        samlRequest: response.saml_request,
        relayState: response.relay_state,
      };
    },
  };

  async exchange(input: OAuthExchangeInput): Promise<OAuthExchangeResponse> {
    assertExchangeInput(input);
    return this.request<OAuthExchangeResponse>("POST", "/token/exchange", {
      body: {
        code: input.code.trim(),
        connection_id: input.connection_id.trim(),
      },
    });
  }

  readonly connections: OAuthConnectionsApi = {
    get: async (connectionId: string): Promise<OAuthConnectionResponse> => {
      assertConnectionId(connectionId);
      return this.request<OAuthConnectionResponse>(
        "GET",
        `/connections/${encodeURIComponent(connectionId.trim())}`
      );
    },

    getToken: async (connectionId: string): Promise<OAuthTokenResponse> => {
      assertConnectionId(connectionId);
      return this.request<OAuthTokenResponse>(
        "GET",
        `/connections/${encodeURIComponent(connectionId.trim())}/token`
      );
    },

    sync: async (connectionId: string): Promise<OAuthTokenResponse> => {
      return this.connections.getToken(connectionId);
    },

    refresh: async (connectionId: string): Promise<OAuthConnectionWithTokenResponse> => {
      assertConnectionId(connectionId);
      return this.request<OAuthConnectionWithTokenResponse>(
        "POST",
        `/connections/${encodeURIComponent(connectionId.trim())}/refresh`
      );
    },

    revoke: async (
      connectionId: string,
      input?: OAuthRevokeInput
    ): Promise<OAuthRevokeResponse> => {
      assertConnectionId(connectionId);
      const body: Record<string, unknown> = {};
      if (input?.reason?.trim()) {
        body.reason = input.reason.trim();
      }
      return this.request<OAuthRevokeResponse>(
        "POST",
        `/connections/${encodeURIComponent(connectionId.trim())}/revoke`,
        { body: Object.keys(body).length ? body : undefined }
      );
    },

    delete: async (connectionId: string): Promise<OAuthDeleteResponse> => {
      assertConnectionId(connectionId);
      return this.request<OAuthDeleteResponse>(
        "DELETE",
        `/connections/${encodeURIComponent(connectionId.trim())}`
      );
    },
  };
}
