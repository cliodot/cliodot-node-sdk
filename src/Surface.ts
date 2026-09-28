import axios, { AxiosInstance } from "axios";
import crypto from "crypto";
import { CliodotApiError, cliodotApiErrorFromAxios } from "./errors";
import {
  parseApiErrorCode,
  parseApiErrorMessage,
  parseApiErrorStatus,
} from "./http/parse-api-error";
import { applyEnvironmentHeader } from "./http/cliodot-request";

export interface SurfaceConfig {
  baseUrl: string;
  slug?: string;
  apiKey?: string;
  jwt?: string;
  apiKeyHeader?: string;
  fetchSurface?: boolean;
  version?: string;
  /** Pin project env bag for connector auth templates. Omit to follow the project switch. */
  environment?: "dev" | "prod" | "development" | "production";
}

export interface SurfaceOp {
  id: string;
  sdk_path: string[];
  op: string;
  method: string;
  endpoint_path: string;
  path_params: string[];
  query_schema: Record<string, unknown> | null;
  body: boolean;
  body_schema?: Record<string, unknown> | null;
  endpoint_id?: string;
}

export interface SurfaceCatalog {
  version: number;
  gateway: {
    slug: string;
    name?: string;
    base_url?: string;
    auth_type?: string;
    client_name?: string;
    sdk_enabled?: boolean;
  };
  ops: SurfaceOp[];
}

const DEFAULT_SDK_VERSION = "1.2.1";

function trimBaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

function sha256Hex(value: string): string {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

function hmacSha256Hex(secret: string, payload: string): string {
  return crypto.createHmac("sha256", secret).update(payload, "utf8").digest("hex");
}

function randomNonce(): string {
  return crypto.randomBytes(16).toString("hex");
}

function buildCanonical(input: {
  timestamp: string;
  nonce: string;
  method: string;
  path: string;
  body?: unknown;
}): string {
  const bodyRaw =
    input.body === undefined ||
    input.body === null ||
    (typeof input.body === "object" &&
      !Array.isArray(input.body) &&
      Object.keys(input.body as object).length === 0)
      ? ""
      : typeof input.body === "string"
        ? input.body
        : JSON.stringify(input.body);
  return [
    input.timestamp,
    input.nonce,
    (input.method || "GET").toUpperCase(),
    input.path || "/",
    sha256Hex(bodyRaw),
  ].join(".");
}

function sanitizePathParamKey(name: string): string {
  return String(name || "")
    .replace(/[^a-zA-Z0-9_]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

function fillEndpointPath(template: string, pathParams: Record<string, string>): string {
  let path = template;
  const entries = Object.entries(pathParams).sort((a, b) => b[0].length - a[0].length);

  const replaceName = (current: string, name: string, encoded: string): string => {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return current
      .replace(new RegExp(`:${escaped}(?=$|[/?#&]|[^a-zA-Z0-9_-])`, "g"), encoded)
      .replace(new RegExp(`\\{\\{\\s*${escaped}\\s*\\}\\}`, "g"), encoded)
      .replace(new RegExp(`\\{${escaped}\\}`, "g"), encoded);
  };

  for (const [name, value] of entries) {
    path = replaceName(path, name, encodeURIComponent(value));
  }

  const remaining = [
    ...path.matchAll(/\{\{\s*([a-zA-Z_][a-zA-Z0-9_-]*)\s*\}\}/g),
    ...path.matchAll(/:([a-zA-Z_][a-zA-Z0-9_-]*)(?=$|[/?#&]|[^a-zA-Z0-9_-])/g),
    ...path.matchAll(/\{([a-zA-Z_][a-zA-Z0-9_-]*)\}/g),
  ].map((match) => match[1]);

  for (const placeholder of remaining) {
    const normalizedPlaceholder = sanitizePathParamKey(placeholder);
    const match = entries.find(
      ([key]) => sanitizePathParamKey(key) === normalizedPlaceholder
    );
    if (!match) continue;
    path = replaceName(path, placeholder, encodeURIComponent(match[1]));
  }

  if (!path.startsWith("/")) path = `/${path}`;
  return path;
}

class SurfaceRuntime {
  private readonly rootBaseUrl: string;
  private readonly invokeBaseUrl: string;
  private readonly slug?: string;
  private readonly apiKey?: string;
  private readonly jwt?: string;
  private readonly apiKeyHeader: string;
  private readonly sdkVersion: string;
  private readonly environment?: string;
  private readonly axios: AxiosInstance;
  private surfacePromise: Promise<SurfaceCatalog> | null = null;
  private surface: SurfaceCatalog | null = null;

  constructor(config: SurfaceConfig) {
    if (!config.baseUrl?.trim()) {
      throw new CliodotApiError("Surface requires baseUrl");
    }
    this.rootBaseUrl = trimBaseUrl(config.baseUrl);
    this.slug = config.slug?.trim() || undefined;
    this.apiKey = config.apiKey?.trim() || undefined;
    this.jwt = config.jwt?.trim() || undefined;
    this.apiKeyHeader = config.apiKeyHeader?.trim() || "X-API-Key";
    this.sdkVersion = config.version?.trim() || DEFAULT_SDK_VERSION;
    this.environment = config.environment;
    this.invokeBaseUrl = this.slug
      ? `${this.rootBaseUrl}/${this.slug}`
      : this.rootBaseUrl;
    this.axios = axios.create({
      timeout: 60000,
      validateStatus: () => true,
    });
  }

  private failResponse(
    response: { status?: number; data?: any },
    fallback: string,
    code?: string
  ): never {
    const data = response?.data;
    const message =
      parseApiErrorMessage(data) ||
      (typeof data?.error === "string" ? data.error : undefined) ||
      fallback;
    throw new CliodotApiError(message, {
      status: parseApiErrorStatus(data, response?.status),
      data,
      code: code || parseApiErrorCode(data),
    });
  }

  private signingSecret(): string {
    if (this.apiKey) return this.apiKey;
    if (this.jwt) return this.jwt;
    return `sdk:${this.slug || "gateway"}`;
  }

  private attestationHeaders(method: string, path: string, body?: unknown): Record<string, string> {
    const timestamp = String(Date.now());
    const nonce = randomNonce();
    const canonical = buildCanonical({ timestamp, nonce, method, path, body });
    const signature = hmacSha256Hex(this.signingSecret(), canonical);
    const headers: Record<string, string> = {
      "X-Cliodot-Client": "sdk",
      "X-Cliodot-SDK-Version": this.sdkVersion,
      "X-Cliodot-SDK-Timestamp": timestamp,
      "X-Cliodot-SDK-Nonce": nonce,
      "X-Cliodot-SDK-Signature": signature,
    };
    if (this.apiKey) {
      headers[this.apiKeyHeader] = this.apiKey;
    }
    if (this.jwt) {
      headers.Authorization = `Bearer ${this.jwt}`;
    }
    return applyEnvironmentHeader(headers, this.environment);
  }

  async loadSurface(force = false): Promise<SurfaceCatalog> {
    if (!force && this.surface) return this.surface;
    if (!force && this.surfacePromise) return this.surfacePromise;

    this.surfacePromise = (async () => {
      const path = "/sdk/surface";
      const url = `${this.invokeBaseUrl}${path}`;
      try {
        const response = await this.axios.get(url, {
          headers: this.attestationHeaders("GET", path),
        });
        if (response.status >= 400 || response.data?.ok === false) {
          this.failResponse(
            response,
            `Failed to load surface (${response.status})`,
            "SURFACE_LOAD_FAILED"
          );
        }
        this.surface = response.data.surface as SurfaceCatalog;
        return this.surface;
      } catch (error) {
        this.surfacePromise = null;
        if (error instanceof CliodotApiError) throw error;
        throw cliodotApiErrorFromAxios(error, "Failed to load surface");
      }
    })();

    return this.surfacePromise;
  }

  private findOp(sdkPath: string[], op: string, catalog: SurfaceCatalog): SurfaceOp {
    const match = catalog.ops.find(
      (item) =>
        item.op === op &&
        item.sdk_path.length === sdkPath.length &&
        item.sdk_path.every((segment, index) => segment === sdkPath[index])
    );
    if (!match) {
      const fluent = [...sdkPath, op].join(".");
      throw new CliodotApiError(`SDK operation not exposed: ${fluent}`, {
        code: "SDK_OP_NOT_EXPOSED",
      });
    }
    return match;
  }

  async invoke(sdkPath: string[], opName: string, args: unknown[]): Promise<unknown> {
    const catalog = await this.loadSurface();
    const op = this.findOp(sdkPath, opName, catalog);

    let argIndex = 0;
    const pathParams: Record<string, string> = {};
    for (const name of op.path_params || []) {
      const value = args[argIndex++];
      if (value === undefined || value === null) {
        throw new CliodotApiError(`Missing path argument: ${name}`);
      }
      pathParams[name] = String(value);
    }

    let body: unknown;
    let query: Record<string, unknown> | undefined;
    if (op.body) {
      body = args[argIndex++];
    }
    if (op.query_schema) {
      query = (args[argIndex++] as Record<string, unknown>) || undefined;
    }

    const endpointPath = fillEndpointPath(op.endpoint_path, pathParams);
    const url = `${this.invokeBaseUrl}${endpointPath}`;
    const hasBody = !!op.body && body !== undefined;
    const headers = this.attestationHeaders(
      op.method,
      endpointPath,
      hasBody ? body : undefined
    );
    if (hasBody) {
      headers["Content-Type"] = "application/json";
    }

    try {
      const response = await this.axios.request({
        url,
        method: op.method,
        headers,
        params: query,
        data: hasBody ? body : undefined,
      });
      if (response.status >= 400 || response.data?.ok === false) {
        this.failResponse(
          response,
          `Surface request failed (${response.status})`,
          "SURFACE_REQUEST_FAILED"
        );
      }
      return response.data?.data !== undefined ? response.data.data : response.data;
    } catch (error) {
      if (error instanceof CliodotApiError) throw error;
      throw cliodotApiErrorFromAxios(error, "Surface request failed");
    }
  }

  asProxy(path: string[] = []): any {
    const runtime = this;
    const callable = (...args: unknown[]) => {
      if (path.length === 0) {
        throw new CliodotApiError("Surface root is not callable");
      }
      const op = path[path.length - 1];
      const sdkPath = path.slice(0, -1);
      return runtime.invoke(sdkPath, op, args);
    };

    return new Proxy(callable, {
      get(_target, prop) {
        if (typeof prop === "symbol") return undefined;
        if (prop === "then") return undefined;
        if (prop === "loadSurface") {
          return (force?: boolean) => runtime.loadSurface(force);
        }
        if (prop === "toString") return () => "[Surface]";
        return runtime.asProxy([...path, String(prop)]);
      },
      apply(_target, _thisArg, argArray) {
        return callable(...((argArray as unknown[]) || []));
      },
    });
  }
}

export type SurfaceHelpers = {
  loadSurface(force?: boolean): Promise<SurfaceCatalog>;
};

export type SurfaceClient<TSurface = any> = TSurface & SurfaceHelpers;

type SurfaceConstructor = {
  new <TSurface = any>(config: SurfaceConfig): SurfaceClient<TSurface>;
};

export const Surface = function Surface(
  this: unknown,
  config: SurfaceConfig
): SurfaceClient {
  const runtime = new SurfaceRuntime(config);
  return runtime.asProxy() as SurfaceClient;
} as unknown as SurfaceConstructor;
