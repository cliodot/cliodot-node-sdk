import { AxiosInstance } from "axios";
import { CliodotApiError, cliodotApiErrorFromAxios } from "./errors";
import { createCliodotAxios } from "./http/create-client";
import { parseApiErrorCode, parseApiErrorMessage } from "./http/parse-api-error";
import { applyEnvironmentHeader } from "./http/cliodot-request";
import type {
  IdentityAppClientApi,
  IdentityAppClientConfig,
  IdentityAuthenticateInput,
  IdentityAuthenticateResponse,
  IdentityJwks,
  IdentityMeResponse,
  IdentityProviderHandle,
  IdentityRefreshInput,
  IdentityRevokeInput,
  IdentityRevokeResponse,
  IdentityVerifyInput,
  IdentityVerifyResponse,
} from "./types/identity-app.api";

function trimBaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

function resolveInternalProviderId(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new CliodotApiError("provider requires a non-empty Identity App id");
  }
  if (trimmed.startsWith("ext:") || trimmed.startsWith("ext_")) {
    throw new CliodotApiError(
      "provider() resolves internal Identity Apps only; use extProvider() for external profiles"
    );
  }
  return trimmed;
}

function resolveExternalProviderId(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new CliodotApiError("extProvider requires a non-empty profile slug or id");
  }
  if (trimmed.startsWith("ext:") || trimmed.startsWith("ext_")) {
    return trimmed;
  }
  return `ext:${trimmed}`;
}

export class IdentityAppClient implements IdentityAppClientApi {
  private readonly baseUrl: string;
  private readonly appId: string;
  private readonly apiKey?: string;
  private readonly appSecret?: string;
  private readonly environment?: string;
  private readonly axios: AxiosInstance;
  public readonly debug: boolean;

  constructor(config: IdentityAppClientConfig) {
    if (!config.baseUrl?.trim()) {
      throw new CliodotApiError("IdentityAppClient requires baseUrl");
    }
    if (!config.appId?.trim()) {
      throw new CliodotApiError("IdentityAppClient requires appId");
    }
    this.baseUrl = trimBaseUrl(config.baseUrl);
    this.appId = config.appId.trim();
    this.apiKey =
      config.apiKey?.trim() || config.appApiKey?.trim() || undefined;
    this.appSecret = config.appSecret?.trim() || undefined;
    this.environment = config.environment;
    this.debug = config.debug ?? false;
    this.axios = createCliodotAxios({
      baseURL: `${this.baseUrl}/identity`,
      timeout: config.timeoutMs ?? 30000,
      headers: { "Content-Type": "application/json" },
    });
  }

  me(): Promise<IdentityMeResponse> {
    return this.request<IdentityMeResponse>("GET", "/v1/me");
  }

  authenticate(
    input: IdentityAuthenticateInput
  ): Promise<IdentityAuthenticateResponse> {
    if (!input?.target_app_id?.trim()) {
      throw new CliodotApiError("authenticate requires target_app_id");
    }
    const body: Record<string, unknown> = {
      target_app_id: input.target_app_id.trim(),
    };
    if (input.scopes !== undefined) {
      body.scopes = input.scopes;
    }
    return this.request<IdentityAuthenticateResponse>(
      "POST",
      "/v1/authenticate",
      body
    );
  }

  verify(input: IdentityVerifyInput): Promise<IdentityVerifyResponse> {
    if (!input?.access_token?.trim()) {
      throw new CliodotApiError("verify requires access_token");
    }
    const body: Record<string, unknown> = {
      access_token: input.access_token.trim(),
    };
    if (input.required_scopes !== undefined) {
      body.required_scopes = input.required_scopes;
    }
    const target = input.target_app_id?.trim();
    if (target) {
      return this.request<IdentityVerifyResponse>(
        "POST",
        `/v1/apps/${encodeURIComponent(target)}/verify`,
        body
      );
    }
    return this.request<IdentityVerifyResponse>("POST", "/v1/verify", body);
  }

  refresh(
    input: IdentityRefreshInput
  ): Promise<IdentityAuthenticateResponse> {
    if (!input?.refresh_token?.trim()) {
      throw new CliodotApiError("refresh requires refresh_token");
    }
    return this.request<IdentityAuthenticateResponse>(
      "POST",
      "/v1/token/refresh",
      {
        refresh_token: input.refresh_token.trim(),
      }
    );
  }

  revoke(input: IdentityRevokeInput): Promise<IdentityRevokeResponse> {
    const access = input?.access_token?.trim();
    const refresh = input?.refresh_token?.trim();
    if (!access && !refresh) {
      throw new CliodotApiError(
        "revoke requires access_token or refresh_token"
      );
    }
    const body: Record<string, string> = {};
    if (access) body.access_token = access;
    if (refresh) body.refresh_token = refresh;
    return this.request<IdentityRevokeResponse>(
      "POST",
      "/v1/token/revoke",
      body
    );
  }

  async getJwks(appId: string): Promise<IdentityJwks> {
    if (!appId?.trim()) {
      throw new CliodotApiError("getJwks requires appId");
    }
    try {
      const { data } = await this.axios({
        method: "GET",
        url: `/v1/apps/${encodeURIComponent(appId.trim())}/jwks.json`,
      });
      if (data?.ok === false) {
        throw new CliodotApiError(
          parseApiErrorMessage(data) || "JWKS request failed",
          {
            data,
            code: parseApiErrorCode(data),
          }
        );
      }
      return data as IdentityJwks;
    } catch (err: any) {
      if (err instanceof CliodotApiError) throw err;
      throw cliodotApiErrorFromAxios(err, `Request failed: GET jwks`);
    }
  }

  provider(name: string): IdentityProviderHandle {
    const target_app_id = resolveInternalProviderId(name);
    return this.buildProviderHandle(target_app_id);
  }

  extProvider(name: string): IdentityProviderHandle {
    const target_app_id = resolveExternalProviderId(name);
    return this.buildProviderHandle(target_app_id);
  }

  private buildProviderHandle(target_app_id: string): IdentityProviderHandle {
    return {
      target_app_id,
      authenticate: (scopes?: string | string[]) => {
        const input: IdentityAuthenticateInput = { target_app_id };
        if (scopes !== undefined) input.scopes = scopes;
        return this.authenticate(input);
      },
      verify: (accessToken: string, required_scopes?: string[]) => {
        const input: IdentityVerifyInput = {
          access_token: accessToken,
          target_app_id,
        };
        if (required_scopes !== undefined) {
          input.required_scopes = required_scopes;
        }
        return this.verify(input);
      },
      refresh: (refreshToken: string) =>
        this.refresh({ refresh_token: refreshToken }),
    };
  }

  private buildAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = applyEnvironmentHeader(
      {
        "x-cliodot-app-id": this.appId,
      },
      this.environment
    );
    if (this.apiKey) {
      headers.Authorization = `Bearer ${this.apiKey}`;
      return headers;
    }
    if (this.appSecret) {
      headers["x-cliodot-app-secret"] = this.appSecret;
      return headers;
    }
    throw new CliodotApiError(
      "Identity app credentials required (apiKey/appApiKey or appSecret)"
    );
  }

  private async request<T>(
    method: string,
    path: string,
    body?: Record<string, unknown>
  ): Promise<T> {
    try {
      const { data } = await this.axios({
        method,
        url: path,
        headers: this.buildAuthHeaders(),
        data: body,
      });
      if (data?.ok === false) {
        throw new CliodotApiError(
          parseApiErrorMessage(data) || "Identity request failed",
          {
            data,
            code: parseApiErrorCode(data),
          }
        );
      }
      return data as T;
    } catch (err: any) {
      if (err instanceof CliodotApiError) throw err;
      throw cliodotApiErrorFromAxios(
        err,
        `Request failed: ${method} ${path}`
      );
    }
  }
}
