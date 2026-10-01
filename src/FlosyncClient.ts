import { AxiosInstance } from "axios";
import { IWorkflow } from "./types/workflow";
import { IFunction } from "./types/function";
import { stepsToNodes } from "./transformers/StepsToNodesTransformer";
import type { ConnectorsApi, WorkflowsApi, FunctionsApi, ProjectsApi } from "./types/client.api";
import { CliodotApiError, cliodotApiErrorFromAxios } from "./errors";
import { createCliodotAxios } from "./http/create-client";
import { sanitizeExecutionHeaders } from "./http/sanitize-execution-headers";

export const DEFAULT_CLIODOT_BASE_URL = "https://sdk.flowfly.dev";

const DEFAULT_TOKEN_REFRESH_MARGIN_MS = 10 * 60 * 1000;
const DEFAULT_FALLBACK_REUSE_MS = 50 * 60 * 1000;

function decodeJwtExpMs(token: string): number | null {
  try {
    if (typeof Buffer === "undefined") return null;
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const pad = b64.length % 4 === 0 ? "" : "=".repeat(4 - (b64.length % 4));
    const payload = JSON.parse(Buffer.from(b64 + pad, "base64").toString("utf8"));
    return typeof payload.exp === "number" ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

function parseExpiryMsFromLoginBody(data: any, token: string): number | null {
  const iso = data?.tokenExpiresAt ?? data?.expiresAt ?? data?.expires_at;
  if (iso != null && typeof iso === "string") {
    const t = Date.parse(iso);
    if (!Number.isNaN(t)) return t;
  }
  const expiresIn = data?.expires_in ?? data?.expiresIn;
  if (typeof expiresIn === "number" && Number.isFinite(expiresIn)) {
    return Date.now() + Math.max(0, expiresIn) * 1000;
  }
  return decodeJwtExpMs(token);
}

function toFinalWorkflowResult(data: any, debug?: boolean): any {

  if (data?.result?.response) {
    const result: any = {
      statusCode: data.result.response.statusCode,
      data: data.result.response?.body ?? {},
    };
    if (debug && data.result.stepResults) {
      result._debug = { stepResults: data.result.stepResults };
    }
    return result;
  }
  if (data?.result?.stepResults) {
    const keys = Object.keys(data.result.stepResults);
    const result = data.result.stepResults[keys?.[0]];
    if (debug) {
      return { data: result, _debug: { stepResults: data.result.stepResults } };
    }
    return result;
  }
  return data;
}

export interface FlosyncClientConfig {
  baseUrl?: string;
  apiKey: string;
  apiSecret: string;
  tokenRefreshMarginMs?: number;
  tokenFallbackReuseMs?: number;
  debug?: boolean;
}

export class FlosyncClient {
  private baseUrl: string;
  private apiKey: string;
  private apiSecret: string;
  private jwt: string | null = null;
  private tokenReuseUntilMs = 0;
  private tokenRefreshMarginMs: number;
  private tokenFallbackReuseMs: number;
  private loginPromise: Promise<void> | null = null;
  private axios: AxiosInstance;
  public debug: boolean;

  constructor(config: FlosyncClientConfig) {
    this.baseUrl = (config.baseUrl ?? DEFAULT_CLIODOT_BASE_URL).replace(/\/+$/, "");
    this.apiKey = config.apiKey;
    this.apiSecret = config.apiSecret;
    this.tokenRefreshMarginMs = config.tokenRefreshMarginMs ?? DEFAULT_TOKEN_REFRESH_MARGIN_MS;
    this.tokenFallbackReuseMs = config.tokenFallbackReuseMs ?? DEFAULT_FALLBACK_REUSE_MS;
    this.debug = config.debug ?? false;
    this.axios = createCliodotAxios({
      baseURL: `${this.baseUrl}/api-core/cliodot`,
      timeout: 30000,
      headers: { "Content-Type": "application/json" },
    });
  }

  private invalidateSessionToken(): void {
    this.jwt = null;
    this.tokenReuseUntilMs = 0;
  }

  private setSessionFromLoginResponse(data: any): void {
    const token = data?.token ?? data?.accessToken ?? data?.access_token;
    if (!token || typeof token !== "string") {
      const errMsg = data?.error || data?.message || "Login failed: no token in response";
      throw new Error(errMsg);
    }
    this.jwt = token;
    const serverExpiryMs = parseExpiryMsFromLoginBody(data, token);
    const margin = Math.max(0, this.tokenRefreshMarginMs);
    if (serverExpiryMs != null && serverExpiryMs > Date.now()) {
      this.tokenReuseUntilMs = Math.max(Date.now(), serverExpiryMs - margin);
    } else {
      this.tokenReuseUntilMs = Date.now() + this.tokenFallbackReuseMs;
    }
  }

  async authenticate(): Promise<void> {
    const { data } = await this.axios.post("/user/login-with-api-key", {
      apiKey: this.apiKey,
      apiSecret: this.apiSecret,
    });
    this.setSessionFromLoginResponse(data);
  }

  private sessionTokenIsFresh(): boolean {
    return !!this.jwt && Date.now() < this.tokenReuseUntilMs;
  }

  private async ensureAuth(): Promise<string> {
    if (this.sessionTokenIsFresh()) return this.jwt!;
    if (this.loginPromise) {
      await this.loginPromise;
      if (this.sessionTokenIsFresh()) return this.jwt!;
    }

    this.loginPromise = (async () => {
      try {
        await this.authenticate();
      } finally {
        this.loginPromise = null;
      }
    })();
    await this.loginPromise;
    return this.jwt!;
  }

  private async request(
    method: string,
    path: string,
    body?: any,
    params?: any,
    headers?: Record<string, string>,
    isRetryAfter401?: boolean
  ): Promise<any> {
    const token = await this.ensureAuth();
    const cfg: any = {
      method,
      url: path,
      headers: { Authorization: `Bearer ${token}`, ...headers },
    };
    if (body) cfg.data = body;
    if (params) cfg.params = params;
    try {
      const { data } = await this.axios(cfg);
      return data;
    } catch (err: any) {
      if (err?.response?.status === 401 && !isRetryAfter401) {
        this.invalidateSessionToken();
        return this.request(method, path, body, params, headers, true);
      }
      throw cliodotApiErrorFromAxios(err, `Request failed: ${method} ${path}`);
    }
  }

  connectors: ConnectorsApi = {
    get: async (connectorId: string, options?: { semver?: string; version?: string }): Promise<any> => {
      const params: Record<string, string> = {};
      const v = options?.semver ?? options?.version;
      if (v) {
        params.semver = v;
      }
      const data = await this.request("GET", `/connectors/${connectorId}`, undefined, params);
      const c = data?.connector ?? data;
      if (!c) return null;
      return {
        _id: c._id ?? connectorId,
        name: c.name,
        type: c.type ?? "REST",
        base_url: c.base_url,
        auth: c.auth ?? { type: "none" },
        endpoints: c.endpoints ?? [],
      };
    },
    list: async (options?: { type?: string; status?: string; category?: string; page?: number; limit?: number }): Promise<any> => {
      const params: Record<string, any> = {};
      if (options?.type) params.type = options.type;
      if (options?.status) params.status = options.status;
      if (options?.category) params.category = options.category;
      if (options?.page) params.page = options.page;
      if (options?.limit) params.limit = options.limit;
      const data = await this.request("GET", "/connectors", undefined, params);
      return { connectors: data?.connectors ?? data?.items ?? [], pagination: data?.pagination };
    },
    search: async (options?: { term?: string; category?: string; page?: number; limit?: number }): Promise<any> => {
      const params: Record<string, any> = {};
      if (options?.term) params.search = options.term;
      if (options?.category) params.category = options.category;
      if (options?.page) params.page = options.page;
      if (options?.limit) params.limit = options.limit;
      const data = await this.request("GET", "/connectors/search", undefined, params);
      return { connectors: data?.connectors ?? data?.items ?? [], pagination: data?.pagination };
    },
    installed: async (options?: { status?: string; page?: number; limit?: number }): Promise<any> => {
      const params: Record<string, any> = {};
      if (options?.status) params.status = options.status;
      if (options?.page) params.page = options.page;
      if (options?.limit) params.limit = options.limit;
      const data = await this.request("GET", "/connectors/installed", undefined, params);
      return { installations: data?.installations ?? data?.items ?? [], pagination: data?.pagination };
    },
    push: async (connector: Record<string, any>): Promise<any> => {
      const id = connector._id ?? connector.slug;
      if (!id) throw new Error("Connector must have _id or slug");
      try {
        await this.request("GET", `/connectors/${id}`);
        return this.request("PUT", `/connectors/${id}`, connector);
      } catch {
        return this.request("POST", "/connectors", connector);
      }
    },
    install: async (
      connectorId: string,
      options?: { auth?: any; base_url?: string; version?: string }
    ): Promise<any> => {
      const data = await this.request("POST", `/connectors/${connectorId}/install`, options ?? {});
      return data?.installation ?? data;
    },
    uninstall: async (connectorId: string): Promise<any> => {
      return this.request("POST", `/connectors/${connectorId}/uninstall`);
    },
    execute: async (
      connectorId: string,
      action: string,
      options?: {
        body?: Record<string, any>;
        params?: Record<string, any>;
        pathParams?: Record<string, any>;
        headers?: Record<string, string>;
        installation_id?: string;
        database?: string;
        connection_id?: string;
        timeout?: number;
        vars?: Record<string, any>;
        connector_version?: string;
      }
    ): Promise<any> => {
      const requestBody: Record<string, any> = {
        ...options?.body,
        installation_id: options?.installation_id,
        database: options?.database,
        connection_id: options?.connection_id,
        connector_version: options?.connector_version,
      };
      const filteredBody = Object.fromEntries(Object.entries(requestBody).filter(([, v]) => v !== undefined));
      const queryParams = options?.params;
      // console.log("HERE WE GO", filteredBody)
      const headers = options?.headers;
      const data = await this.request(
        "POST",
        `/connectors/${connectorId}/actions/${encodeURIComponent(action)}`,
        Object.keys(filteredBody).length ? filteredBody : undefined,
        queryParams,
        headers
      );
      if (data?.ok === false) throw new Error(data?.error ?? "Connector execution failed");
      return data?.data ?? data;
    },
  };

  workflows: WorkflowsApi = {
    push: async (workflow: IWorkflow): Promise<any> => {
      const group = stepsToNodes(workflow);
      const groupId = workflow._id;
      try {
        await this.request("GET", `/workflows/${groupId}`);
        return this.request("PUT", `/workflows/${groupId}`, group);
      } catch {
        return this.request("POST", "/workflows", group);
      }
    },
    pull: async (groupId: string): Promise<IWorkflow> => {
      const data = await this.request("GET", `/workflows/${groupId}`);
      const wg = data?.workflowGroup || data;
      const dataItem = Array.isArray(wg?.data) ? wg.data[0] : wg;
      if (!dataItem || !dataItem.nodes) throw new Error("Workflow not found");
      const { WorkflowTransformer } = await import("./transformers/WorkflowTransformer");
      return WorkflowTransformer.transform(
        dataItem,
        wg._id || groupId,
        wg.tenant_id || "",
        wg.vars,
        wg.project_id
      );
    },
    list: async (options?: {
      status?: string;
      type?: string;
      name?: string;
      project_id?: string;
      page?: number;
      limit?: number;
    }): Promise<{ workflowGroups: any[]; pagination?: any }> => {
      const params: Record<string, any> = {};
      if (options?.status) params.status = options.status;
      if (options?.type) params.type = options.type;
      if (options?.name) params.name = options.name;
      if (options?.project_id) params.project_id = options.project_id;
      if (options?.page) params.page = options.page;
      if (options?.limit) params.limit = options.limit;
      const data = await this.request("GET", "/workflows", undefined, params);
      return {
        workflowGroups: data?.workflowGroups ?? data?.items ?? [],
        pagination: data?.pagination,
      };
    },
    run: async (
      groupId: string,
      triggerId: string,
      opts: { payload?: any; environment?: "dev" | "prod"; executionHeaders?: Record<string, string> } = {}
    ): Promise<any> => {
      const { payload, environment, executionHeaders } = opts;
      const body: Record<string, any> = {};
      if (payload !== undefined) body.payload = payload;
      if (environment !== undefined) body.environment = environment;
      const exec = sanitizeExecutionHeaders(executionHeaders ?? {});
      if (Object.keys(exec).length > 0) body.executionHeaders = exec;
      const data = await this.request("POST", `/workflows/${groupId}/test/trigger/${triggerId}`, body);
      return toFinalWorkflowResult(data, this.debug);
    },
    runByWebhook: async (
      webhookPath: string,
      method: string,
      payload: { body?: any; environment?: "dev" | "prod"; executionHeaders?: Record<string, string> } & Record<string, any> = {}
    ): Promise<any> => {
      const { environment, body, executionHeaders, ...rest } = payload;
      const innerPayload = { ...(body ?? {}), ...rest };
      const exec = sanitizeExecutionHeaders(executionHeaders ?? {});
      const reqBody: Record<string, any> = {
        webhookPath,
        webhookMethod: method,
        payload: innerPayload,
      };
      if (environment !== undefined) reqBody.environment = environment;
      if (Object.keys(exec).length > 0) reqBody.executionHeaders = exec;
      const data = await this.request("POST", "/workflows/test/webhook", reqBody);
      return toFinalWorkflowResult(data, this.debug);
    },
    promote: async (groupId: string): Promise<any> => {
      return this.request("POST", `/workflows/${groupId}/promote`);
    },
  };

  functions: FunctionsApi = {
    list: async (): Promise<any[]> => {
      const data = await this.request("GET", "/functions");
      return data?.functions ?? data?.items ?? data ?? [];
    },
    push: async (fn: IFunction): Promise<any> => {
      const payload = {
        name: fn.name,
        slug: fn.slug || fn._id,
        input_schema: fn.input_schema,
        steps: fn.steps,
        output_from: fn.output_from,
      };
      const id = fn._id;
      try {
        await this.request("GET", `/functions/${id}`);
        return this.request("PUT", `/functions/${id}`, payload);
      } catch {
        return this.request("POST", "/functions", payload);
      }
    },
    pull: async (functionId: string): Promise<IFunction> => {
      const data = await this.request("GET", `/functions/${functionId}`);
      const f = data?.function || data;
      if (!f) throw new Error("Function not found");
      return {
        _id: f._id,
        name: f.name,
        slug: f.slug,
        input_schema: f.input_schema || [],
        steps: f.steps || f.data?.steps || [],
        output_from: f.output_from,
      };
    },
    invoke: async (functionId: string, args: Record<string, any>): Promise<any> => {
      const data = await this.request("POST", `/functions/${functionId}/invoke`, { args });
      return data?.data ?? data?.result ?? data;
    },
    invokePublic: async (slug: string, args: Record<string, any>): Promise<any> => {
      const data = await this.request("POST", `/functions/public/${slug}/invoke`, { args });
      return data?.data ?? data?.result ?? data;
    },
  };

  projects: ProjectsApi = {
    create: async (input: { name: string; description?: string }): Promise<any> => {
      return this.request("POST", "/projects", input);
    },
    list: async (): Promise<any[]> => {
      const data = await this.request("GET", "/projects");
      return data?.projects || data?.items || data || [];
    },
    get: async (projectId: string): Promise<any> => {
      return this.request("GET", `/projects/${projectId}`);
    },
    update: async (projectId: string, input: any): Promise<any> => {
      return this.request("PUT", `/projects/${projectId}`, input);
    },
    delete: async (projectId: string): Promise<any> => {
      return this.request("DELETE", `/projects/${projectId}`);
    },
    setEnvironmentVariables: async (
      projectId: string,
      input: { environment?: string; variables: Record<string, string>; is_secret?: boolean }
    ): Promise<any> => {
      return this.request("POST", `/projects/${projectId}/environment-variables`, input);
    },
    listEnvironmentVariables: async (projectId: string): Promise<any> => {
      return this.request("GET", `/projects/${projectId}/environment-variables`);
    },
    switchEnvironment: async (projectId: string, environment: string): Promise<any> => {
      return this.request("PATCH", `/projects/${projectId}/environment`, { environment });
    },
  };
}
