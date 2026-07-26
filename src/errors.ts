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

export class CliodotApiError extends Error {
  readonly status?: number;
  readonly response?: any;
  readonly data?: any;
  readonly code?: string;

  constructor(
    message: unknown,
    options?: { status?: number; response?: any; data?: any; code?: string }
  ) {
    const data = options?.data ?? options?.response?.data;
    const resolved =
      coerceErrorMessage(message, "") ||
      parseApiErrorMessage(data) ||
      "Request failed";
    super(resolved);
    this.name = "CliodotApiError";
    this.status = options?.status ?? parseApiErrorStatus(data);
    this.response = options?.response;
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
    response: err?.response,
    data,
    code: parseApiErrorCode(data),
  });
}
