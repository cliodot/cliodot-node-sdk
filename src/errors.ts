import {
  parseApiErrorCode,
  parseApiErrorMessage,
  parseApiErrorStatus,
} from "./http/parse-api-error";

export class CliodotApiError extends Error {
  readonly status?: number;
  readonly response?: any;
  readonly data?: any;
  readonly code?: string;

  constructor(message: string, options?: { status?: number; response?: any; data?: any; code?: string }) {
    super(message);
    this.name = "CliodotApiError";
    this.status = options?.status;
    this.response = options?.response;
    this.data = options?.data ?? options?.response?.data;
    this.code = options?.code ?? parseApiErrorCode(this.data);
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
