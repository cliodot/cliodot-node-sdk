import { AxiosInstance } from "axios";
import { createCliodotAxios } from "./http/create-client";
import { executeCliodotRequest, resolveBearerAuthHeaders } from "./http/cliodot-request";
import {
  cliodotFail,
  cliodotValidationFail,
  isCliodotFail,
  resolveConfigError,
  resolveRequiredString,
  type CliodotFail,
  type CliodotMethodResult,
  type CliodotStructuredError,
  SDK_ERROR,
} from "./http/cliodot-result";
import type {
  ProviderCatalogResponse,
  ProviderExecuteInput,
  ProviderExecuteOptions,
  ProviderExecuteResult,
  ProviderSdkTypesArtifact,
  ProviderSdkTypesResponse,
  ProviderServicesClientConfig,
} from "./types/provider-services.api";

function trimBaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

function isExecuteResult(value: unknown): value is ProviderExecuteResult {
  if (!value || typeof value !== "object") return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.service === "string" &&
    typeof obj.operation === "string" &&
    Array.isArray(obj.attempts)
  );
}

function normalizeExecuteResult(
  data: unknown,
  status: number
): ProviderExecuteResult | CliodotFail | null {
  if (!isExecuteResult(data)) return null;
  if (status === 502 || data.ok === false) {
    const error = data.error;
    return {
      ...data,
      ok: false,
      error: {
        code: error?.code || SDK_ERROR.REQUEST_FAILED,
        message: error?.message || "Provider execute failed",
      },
    } as ProviderExecuteResult;
  }
  if (data.ok === true) {
    return data;
  }
  return { ...data, ok: true } as ProviderExecuteResult;
}

export class ProviderServicesClient<TCatalog = any> {
  private readonly baseUrl: string;
  private readonly appId: string;
  private readonly apiKey?: string;
  private readonly appSecret?: string;
  private readonly axios: AxiosInstance;
  private readonly configError: CliodotStructuredError | null;
  public readonly debug: boolean;
  public readonly api: TCatalog;

  constructor(config: ProviderServicesClientConfig) {
    this.configError = resolveConfigError([
      {
        valid: !!config.baseUrl?.trim(),
        message: "ProviderServicesClient requires baseUrl",
      },
      {
        valid: !!config.appId?.trim(),
        message: "ProviderServicesClient requires appId",
      },
    ]);
    this.baseUrl = trimBaseUrl(config.baseUrl || "");
    this.appId = config.appId?.trim() || "";
    this.apiKey =
      config.apiKey?.trim() || config.appApiKey?.trim() || undefined;
    this.appSecret = config.appSecret?.trim() || undefined;
    this.debug = config.debug ?? false;
    this.axios = createCliodotAxios({
      baseURL: `${this.baseUrl}/provider`,
      timeout: config.timeoutMs ?? 60000,
      headers: { "Content-Type": "application/json" },
      validateStatus: (status) => status === 200 || status === 502,
    });
    this.api = this.asProxy() as TCatalog;
  }

  /**
   * Execute a catalog operation. Pass `provider` to pin a binding when routing allows it.
   */
  execute<TResult = Record<string, unknown>>(
    input: ProviderExecuteInput
  ): Promise<ProviderExecuteResult<TResult> | CliodotFail> {
    const serviceError = resolveRequiredString(input?.service, "service");
    if (serviceError) return Promise.resolve(serviceError);
    const operationError = resolveRequiredString(input?.operation, "operation");
    if (operationError) return Promise.resolve(operationError);

    const body: Record<string, unknown> = {
      service: input.service.trim(),
      operation: input.operation.trim(),
      input: input.input ?? {},
    };
    if (input.version?.trim()) body.version = input.version.trim();
    if (input.provider?.trim()) body.provider = input.provider.trim();
    if (input.idempotency_key?.trim()) {
      body.idempotency_key = input.idempotency_key.trim();
    }
    return this.request<ProviderExecuteResult<TResult>>("POST", "/v1/execute", body);
  }

  catalog(): Promise<CliodotMethodResult<ProviderCatalogResponse>> {
    return this.request<ProviderCatalogResponse>("GET", "/v1/catalog");
  }

  async downloadTypes(): Promise<CliodotMethodResult<ProviderSdkTypesArtifact>> {
    const result = await this.request<ProviderSdkTypesResponse>("GET", "/v1/types");
    if (isCliodotFail(result)) return result;
    return {
      ok: true,
      typescript: result.typescript,
      filename: result.filename,
      export_name: result.export_name,
    };
  }

  private asProxy(path: string[] = []): any {
    const client = this;
    const callable = (...args: unknown[]) => {
      if (path.length !== 2) {
        return Promise.resolve(
          cliodotValidationFail(
            "Provider fluent calls are service.operation(input, opts?)"
          )
        );
      }
      const [service, operation] = path;
      const input = (args[0] as Record<string, unknown> | undefined) ?? {};
      const opts = (args[1] as ProviderExecuteOptions | undefined) || {};
      return client.execute({
        service,
        operation,
        input,
        version: opts.version,
        provider: opts.provider,
        idempotency_key: opts.idempotency_key,
      });
    };

    return new Proxy(callable, {
      get(_target, prop) {
        if (typeof prop === "symbol") return undefined;
        if (prop === "then") return undefined;
        if (prop === "toString") return () => "[ProviderServicesClient.api]";
        return client.asProxy([...path, String(prop)]);
      },
      apply(_target, _thisArg, argArray) {
        return callable(...((argArray as unknown[]) || []));
      },
    });
  }

  private buildAuthHeaders() {
    return resolveBearerAuthHeaders({
      appId: this.appId,
      apiKey: this.apiKey,
      appSecret: this.appSecret,
      missingMessage:
        "Provider app credentials required (apiKey/appApiKey or appSecret)",
    });
  }

  private request<T extends Record<string, unknown>>(
    method: string,
    path: string,
    body?: Record<string, unknown>
  ): Promise<CliodotMethodResult<T>> {
    return executeCliodotRequest<T>({
      configError: this.configError,
      authHeaders: this.buildAuthHeaders(),
      axios: this.axios,
      method,
      path,
      body,
      validateStatus: (status) => status === 200 || status === 502,
      passThrough: (data, status) => normalizeExecuteResult(data, status) as T | CliodotFail | null,
      fallbackMessage: `Request failed: ${method} ${path}`,
    });
  }
}
