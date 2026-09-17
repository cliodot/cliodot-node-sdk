import type { AxiosInstance } from "axios";
import {
  cliodotFail,
  failureFromCaught,
  isCliodotFail,
  normalizeApiFailure,
  ensureOkTrue,
  type CliodotFail,
  type CliodotMethodResult,
  type CliodotStructuredError,
  SDK_ERROR,
} from "./cliodot-result";
import { parseApiErrorCode, parseApiErrorMessage } from "./parse-api-error";

export type AuthHeadersResult = Record<string, string> | CliodotFail;

export type ExecuteCliodotRequestOptions<T extends object> = {
  configError?: CliodotStructuredError | null;
  authHeaders: AuthHeadersResult;
  axios: AxiosInstance;
  method: string;
  path: string;
  body?: unknown;
  params?: Record<string, unknown>;
  validateStatus?: (status: number) => boolean;
  transformErrorMessage?: (message: string, code?: string) => string;
  passThrough?: (data: unknown, status: number) => T | CliodotFail | null;
  fallbackMessage?: string;
};

function cleanParams(
  params?: Record<string, unknown>
): Record<string, string | number | boolean> | undefined {
  if (!params) return undefined;
  const out: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    out[key] = value as string | number | boolean;
  }
  return Object.keys(out).length ? out : undefined;
}

export async function executeCliodotRequest<T extends object>(
  options: ExecuteCliodotRequestOptions<T>
): Promise<CliodotMethodResult<T>> {
  if (options.configError) {
    return cliodotFail(options.configError.code, options.configError.message);
  }

  if (isCliodotFail(options.authHeaders)) {
    return options.authHeaders;
  }

  const fallbackMessage =
    options.fallbackMessage || `Request failed: ${options.method} ${options.path}`;

  try {
    const response = await options.axios({
      method: options.method,
      url: options.path,
      headers: options.authHeaders,
      data: options.body,
      params: cleanParams(options.params),
      ...(options.validateStatus ? { validateStatus: options.validateStatus } : {}),
    });

    const data = response.data;
    const status = response.status;

    if (options.passThrough) {
      const passed = options.passThrough(data, status);
      if (passed !== null) {
        return passed as CliodotMethodResult<T>;
      }
    }

    if (status >= 400 || (data && typeof data === "object" && (data as Record<string, unknown>).ok === false)) {
      return normalizeApiFailure(data, status, options.transformErrorMessage);
    }

    return ensureOkTrue<T>(data);
  } catch (err: unknown) {
    return failureFromCaught(err, fallbackMessage, options.transformErrorMessage);
  }
}

export function resolveBearerAuthHeaders(input: {
  appId: string;
  apiKey?: string;
  appSecret?: string;
  missingMessage?: string;
}): AuthHeadersResult {
  const headers: Record<string, string> = {
    "x-cliodot-app-id": input.appId,
  };
  if (input.apiKey) {
    headers.Authorization = `Bearer ${input.apiKey}`;
    return headers;
  }
  if (input.appSecret) {
    headers.Authorization = `Bearer ${input.appSecret}`;
    headers["x-cliodot-app-secret"] = input.appSecret;
    return headers;
  }
  return cliodotFail(
    SDK_ERROR.AUTH,
    input.missingMessage || "App credentials required (apiKey/appApiKey or appSecret)"
  );
}

export function resolveS2SAuthHeaders(input: {
  appId: string;
  appApiKey?: string;
  appSecret?: string;
  missingMessage?: string;
}): AuthHeadersResult {
  if (input.appApiKey) {
    return { Authorization: `Bearer ${input.appApiKey}` };
  }
  if (input.appSecret) {
    return {
      "X-Cliodot-App-Id": input.appId,
      "X-Cliodot-App-Secret": input.appSecret,
    };
  }
  return cliodotFail(
    SDK_ERROR.AUTH,
    input.missingMessage || "App credentials required (appApiKey or appSecret)"
  );
}

export function parseFailureFromBody(data: unknown, status?: number): CliodotFail {
  const code = parseApiErrorCode(data) || (status ? `HTTP_${status}` : SDK_ERROR.REQUEST_FAILED);
  const message = parseApiErrorMessage(data) || "Request failed";
  return cliodotFail(code, message, { status, details: data });
}
