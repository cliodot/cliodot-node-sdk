export function parseApiErrorMessage(data: unknown): string | undefined {
  if (!data || typeof data !== "object") {
    return typeof data === "string" && data.trim() ? data.trim() : undefined;
  }

  const body = data as Record<string, unknown>;

  if (typeof body.message === "string" && body.message.trim()) {
    return body.message.trim();
  }

  if (typeof body.error === "string" && body.error.trim()) {
    return body.error.trim();
  }

  if (body.error && typeof body.error === "object") {
    const nested = body.error as Record<string, unknown>;
    if (typeof nested.message === "string" && nested.message.trim()) {
      return nested.message.trim();
    }
  }

  return undefined;
}

export function parseApiErrorCode(data: unknown): string | undefined {
  if (!data || typeof data !== "object") {
    return undefined;
  }

  const body = data as Record<string, unknown>;

  if (body.error && typeof body.error === "object") {
    const nested = body.error as Record<string, unknown>;
    if (typeof nested.code === "string" && nested.code.trim()) {
      return nested.code.trim();
    }
  }

  if (typeof body.code === "string" && body.code.trim()) {
    return body.code.trim();
  }

  return undefined;
}

export function parseApiErrorStatus(data: unknown, fallback?: number): number | undefined {
  if (!data || typeof data !== "object") {
    return fallback;
  }

  const body = data as Record<string, unknown>;

  if (typeof body.statusCode === "number") {
    return body.statusCode;
  }

  if (body.error && typeof body.error === "object") {
    const nested = body.error as Record<string, unknown>;
    if (typeof nested.statusCode === "number") {
      return nested.statusCode;
    }
  }

  return fallback;
}
