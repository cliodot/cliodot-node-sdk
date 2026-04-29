const BLOCKED_FOR_EXPLICIT_HEADERS = new Set([
  "proxy-authorization",
  "cookie",
  "set-cookie",
  "host",
  "connection",
  "content-length",
  "expect",
  "upgrade",
  "te",
  "trailer",
  "transfer-encoding",
  "keep-alive",
  "www-authenticate",
]);

const DEFAULT_MAX_KEYS = 48;
const DEFAULT_MAX_NAME_LEN = 128;
const DEFAULT_MAX_VALUE_LEN = 8192;
const DEFAULT_MAX_TOTAL_VALUE_CHARS = 65536;

function isBlockedForExplicitExecutionHeaders(lower: string): boolean {
  if (BLOCKED_FOR_EXPLICIT_HEADERS.has(lower)) return true;
  if (lower.startsWith("sec-")) return true;
  if (lower.startsWith("proxy-")) return true;
  return false;
}

function coerceHeaderValue(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  if (Array.isArray(value)) {
    const first = value.find((x) => x !== undefined && x !== null);
    return coerceHeaderValue(first);
  }
  return null;
}

export function sanitizeExecutionHeaders(
  raw: unknown,
  limits?: {
    maxKeys?: number;
    maxNameLen?: number;
    maxValueLen?: number;
    maxTotalValueChars?: number;
  }
): Record<string, string> {
  const maxKeys = limits?.maxKeys ?? DEFAULT_MAX_KEYS;
  const maxNameLen = limits?.maxNameLen ?? DEFAULT_MAX_NAME_LEN;
  const maxValueLen = limits?.maxValueLen ?? DEFAULT_MAX_VALUE_LEN;
  const maxTotalValueChars = limits?.maxTotalValueChars ?? DEFAULT_MAX_TOTAL_VALUE_CHARS;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  let totalChars = 0;
  const out: Record<string, string> = {};
  let count = 0;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (count >= maxKeys) break;
    if (typeof k !== "string") continue;
    const name = k.trim();
    if (!name || name.length > maxNameLen) continue;
    const lower = name.toLowerCase();
    if (isBlockedForExplicitExecutionHeaders(lower)) continue;
    const val = coerceHeaderValue(v);
    if (val === null) continue;
    const clipped = val.length > maxValueLen ? val.slice(0, maxValueLen) : val;
    if (totalChars + clipped.length > maxTotalValueChars) break;
    totalChars += clipped.length;
    out[lower] = clipped;
    count += 1;
  }
  return out;
}
