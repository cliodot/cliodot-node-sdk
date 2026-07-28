import {
  parseApiErrorCode,
  parseApiErrorMessage,
  parseApiErrorStatus,
} from "./http/parse-api-error";

function coerceErrorMessage(message: unknown, fallback: string): string {
  if (typeof message === "string" && message.trim()) return message.trim();
  if (message && typeof message === "object") {
    const parsed = parseApiErrorMessage(message);
    if (parsed) return parsed;
    try {
      return JSON.stringify(message);
    } catch {
      return fallback;
    }
  }
  return fallback;
}

function isAxiosLikeResponse(value: unknown): value is {
  data?: unknown;
  status?: number;
  headers?: unknown;
  config?: unknown;
  request?: unknown;
} {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return (
    "data" in candidate &&
    ("config" in candidate || "request" in candidate || "headers" in candidate)
  );
}

function resolveApiBody(options?: {
  response?: any;
  data?: any;
}): unknown {
  if (options?.data !== undefined) {
    return options.data;
  }
  if (isAxiosLikeResponse(options?.response)) {
    return options?.response?.data;
  }
  return options?.response;
}

export class CliodotApiError extends Error {
  readonly status?: number;
  readonly response?: any;
  readonly data?: any;
  readonly code?: string;

  constructor(
    message: unknown,
    options?: { status?: number; response?: any; data?: any; code?: string }
  ) {
    const data = resolveApiBody(options);
    const resolved =
      coerceErrorMessage(message, "") ||
      parseApiErrorMessage(data) ||
      "Request failed";
    super(resolved);
    this.name = "CliodotApiError";
    this.status =
      options?.status ??
      parseApiErrorStatus(
        data,
        isAxiosLikeResponse(options?.response)
          ? options?.response?.status
          : undefined
      );
    this.response = data;
    this.data = data;
    this.code = options?.code ?? parseApiErrorCode(this.data);
    Object.setPrototypeOf(this, new.target.prototype);
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      status: this.status,
      code: this.code,
      data: this.data,
      response: this.response,
    };
  }
}

export function cliodotApiErrorFromAxios(
  err: any,
  fallbackMessage: string
): CliodotApiError {
  const data = err?.response?.data;
  const message = parseApiErrorMessage(data) || err?.message || fallbackMessage;
  return new CliodotApiError(message, {
    status: parseApiErrorStatus(data, err?.response?.status),
    data,
    code: parseApiErrorCode(data),
  });
}
