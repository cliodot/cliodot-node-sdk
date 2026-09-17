import { parseApiErrorCode, parseApiErrorMessage } from "./parse-api-error";

export type CliodotStructuredError = {
  code: string;
  message: string;
  status?: number;
  details?: unknown;
};

export type CliodotFail = {
  ok: false;
  error: CliodotStructuredError;
};

export type CliodotOk<T extends object = Record<string, never>> = {
  ok: true;
} & T;

export type CliodotMethodResult<T extends object = Record<string, never>> =
  | CliodotOk<T>
  | CliodotFail;

export const SDK_ERROR = {
  CONFIG: "SDK_CONFIG_INVALID",
  VALIDATION: "SDK_VALIDATION",
  AUTH: "SDK_AUTH_MISSING",
  NETWORK: "NETWORK_ERROR",
  UNKNOWN: "UNKNOWN",
  REQUEST_FAILED: "REQUEST_FAILED",
} as const;

export function cliodotFail(
  code: string,
  message: string,
  extras?: { status?: number; details?: unknown }
): CliodotFail {
  return {
    ok: false,
    error: {
      code,
      message,
      ...(extras?.status !== undefined ? { status: extras.status } : {}),
      ...(extras?.details !== undefined ? { details: extras.details } : {}),
    },
  };
}

export function cliodotValidationFail(message: string): CliodotFail {
  return cliodotFail(SDK_ERROR.VALIDATION, message);
}

export function cliodotOk<T extends object>(data: T): CliodotOk<T> {
  return { ok: true, ...data };
}

export function isCliodotFail(value: unknown): value is CliodotFail {
  return (
    !!value &&
    typeof value === "object" &&
    (value as CliodotFail).ok === false &&
    !!(value as CliodotFail).error &&
    typeof (value as CliodotFail).error.code === "string" &&
    typeof (value as CliodotFail).error.message === "string"
  );
}

export function isCliodotOk<T extends object>(
  value: CliodotMethodResult<T> | unknown
): value is CliodotOk<T> {
  return !!value && typeof value === "object" && (value as CliodotOk<T>).ok === true;
}

export function resolveConfigError(
  checks: Array<{ valid: boolean; message: string; code?: string }>
): CliodotStructuredError | null {
  const failed = checks.find((check) => !check.valid);
  if (!failed) return null;
  return {
    code: failed.code || SDK_ERROR.CONFIG,
    message: failed.message,
  };
}

export function resolveRequiredString(
  value: unknown,
  label: string
): CliodotFail | null {
  if (typeof value !== "string" || !value.trim()) {
    return cliodotValidationFail(`${label} is required`);
  }
  return null;
}

export function ensureOkTrue<T extends object>(
  data: unknown
): CliodotMethodResult<T> {
  if (!data || typeof data !== "object") {
    return cliodotFail(SDK_ERROR.UNKNOWN, "Invalid response body");
  }
  const body = data as Record<string, unknown>;
  if (body.ok === false) {
    return normalizeApiFailure(body);
  }
  if (body.ok === true) {
    return body as CliodotOk<T>;
  }
  return cliodotOk(body as T);
}

export function normalizeApiFailure(
  data: unknown,
  status?: number,
  transformMessage?: (message: string, code?: string) => string
): CliodotFail {
  let code = parseApiErrorCode(data) || (status ? `HTTP_${status}` : SDK_ERROR.REQUEST_FAILED);
  let message = parseApiErrorMessage(data) || "Request failed";

  if (transformMessage) {
    message = transformMessage(message, code);
  }

  return cliodotFail(code, message, {
    status,
    details: data,
  });
}

export function failureFromCaught(
  err: unknown,
  fallbackMessage: string,
  transformMessage?: (message: string, code?: string) => string
): CliodotFail {
  if (isCliodotFail(err)) {
    return err;
  }

  const axiosResponse =
    err &&
    typeof err === "object" &&
    "response" in err
      ? (err as { response?: { data?: unknown; status?: number } }).response
      : undefined;

  if (axiosResponse) {
    const status = axiosResponse.status;
    const data = axiosResponse.data;
    if (data && typeof data === "object" && (data as Record<string, unknown>).ok === false) {
      return normalizeApiFailure(data, status, transformMessage);
    }
    let message = fallbackMessage;
    if (data && typeof data === "object") {
      const rawMessage = (data as Record<string, unknown>).message;
      if (typeof rawMessage === "string" && rawMessage.trim()) {
        message = rawMessage.trim();
      }
    } else if (
      typeof (err as { message?: string }).message === "string" &&
      String((err as { message?: string }).message).trim()
    ) {
      message = String((err as { message?: string }).message).trim();
    }
    const code =
      parseApiErrorCode(data) || (status ? `HTTP_${status}` : SDK_ERROR.NETWORK);
    const finalMessage = transformMessage ? transformMessage(message, code) : message;
    return cliodotFail(code, finalMessage, { status, details: data ?? err });
  }

  if (err && typeof err === "object" && "code" in err && "message" in err) {
    const structured = err as CliodotStructuredError;
    const message = transformMessage
      ? transformMessage(structured.message, structured.code)
      : structured.message;
    return cliodotFail(structured.code, message, {
      status: structured.status,
      details: structured.details,
    });
  }

  const message =
    (err instanceof Error && err.message.trim()) ||
    (typeof err === "string" && err.trim()) ||
    fallbackMessage;
  const finalMessage = transformMessage ? transformMessage(message) : message;

  const isNetwork =
    err &&
    typeof err === "object" &&
    ("code" in err || "errno" in err) &&
    !axiosResponse;

  return cliodotFail(
    isNetwork ? SDK_ERROR.NETWORK : SDK_ERROR.UNKNOWN,
    finalMessage,
    { details: err }
  );
}
