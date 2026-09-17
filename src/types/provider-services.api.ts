import type { CliodotFail, CliodotMethodResult } from "../http/cliodot-result";

export type ProviderServicesClientConfig = {
  baseUrl: string;
  appId: string;
  apiKey?: string;
  appApiKey?: string;
  appSecret?: string;
  debug?: boolean;
  timeoutMs?: number;
};

/** Optional execute modifiers (routing pin + version). */
export type ProviderExecuteOptions = {
  /** Operation version; defaults to the catalog current version. */
  version?: string;
  /**
   * Pin a named provider binding (e.g. `paystack`).
   * Honored only when routing `pin_allowed` is true for the operation.
   * Omit to use `default_provider` + `fallback[]` order.
   */
  provider?: string;
  /** Forward-compatible; accepted by the API and ignored in phase 1. */
  idempotency_key?: string;
};

export type ProviderExecuteInput = ProviderExecuteOptions & {
  service: string;
  operation: string;
  input?: Record<string, unknown>;
};

export type ProviderExecuteAttempt = {
  provider: string;
  ok: boolean;
  error?: { code: string; message?: string };
};

export type ProviderExecuteResult<TResult = Record<string, unknown>> = {
  ok: boolean;
  service: string;
  operation: string;
  version: string;
  provider?: string;
  attempts: ProviderExecuteAttempt[];
  result?: TResult;
  error?: { code: string; message?: string };
};

export type ProviderCatalogPublicError = {
  code: string;
  message?: string;
  kind: "retryable" | "terminal";
};

export type ProviderCatalogPublicOperation = {
  key: string;
  name: string;
  current_version: string;
  versions: Array<{
    version: string;
    input_schema?: Record<string, unknown>;
    output_schema?: Record<string, unknown>;
    errors: ProviderCatalogPublicError[];
    async?: boolean;
    idempotency_required?: boolean;
  }>;
};

export type ProviderCatalogPublicService = {
  key: string;
  name: string;
  operations: ProviderCatalogPublicOperation[];
};

export type ProviderCatalogResponse = {
  ok: true;
  catalog: ProviderCatalogPublicService[];
};

export type ProviderSdkTypesArtifact = {
  typescript: string;
  filename: string;
  export_name: string;
};

export type ProviderSdkTypesResponse = ProviderSdkTypesArtifact & {
  ok: true;
};

export type ProviderExecuteResponse<TResult = Record<string, unknown>> =
  | ProviderExecuteResult<TResult>
  | CliodotFail;

export type ProviderCatalogMethodResult = CliodotMethodResult<ProviderCatalogResponse>;

export type ProviderSdkTypesMethodResult = CliodotMethodResult<
  ProviderSdkTypesArtifact & { ok: true }
>;
