import axios, { AxiosInstance } from "axios";
import { IWorkflow } from "./types/workflow";
import { IFunction } from "./types/function";
import { stepsToNodes } from "./transformers/StepsToNodesTransformer";
import type { ConnectorsApi, WorkflowsApi, FunctionsApi, ProjectsApi } from "./types/client.api";
import { CliodotApiError } from "./errors";

export const DEFAULT_CLIODOT_BASE_URL = "http://localhost:8080";

function toFinalWorkflowResult(data: any): any {

  if (data?.result?.response) {
    return{
      statusCode: data.result.response.statusCode,
      data: data.result.response?.body ?? {},
    }
  }
  if (data?.result?.stepResults) {
    const keys = Object.keys(data.result.stepResults)
    return data.result.stepResults[keys?.[0]]
  }
  return data;
}

export interface FlosyncClientConfig {
  baseUrl?: string;
  apiKey: string;
  apiSecret: string;
}

export class FlosyncClient {
  private baseUrl: string;
  private apiKey: string;
  private apiSecret: string;
  private jwt: string | null = null;
  private axios: AxiosInstance;

  constructor(config: FlosyncClientConfig) {
    this.baseUrl = (config.baseUrl ?? DEFAULT_CLIODOT_BASE_URL).replace(/\/+$/, "");
    this.apiKey = config.apiKey;
    this.apiSecret = config.apiSecret;
    this.axios = axios.create({
      baseURL: `${this.baseUrl}/api-core/cliodot`,
      timeout: 30000,
      headers: { "Content-Type": "application/json" },
    });
  }

  async authenticate(): Promise<void> {
    const { data } = await this.axios.post("/user/login-with-api-key", {
      apiKey: this.apiKey,
      apiSecret: this.apiSecret,
    });
    this.jwt = data?.token || data?.accessToken || data?.access_token;
    if (!this.jwt) {
      const errMsg = data?.error || data?.message || "Login failed: no token in response";
      throw new Error(errMsg);
    }
  }

  private async ensureAuth(): Promise<string> {
    if (this.jwt) return this.jwt;
    await this.authenticate();
    return this.jwt!;
  }

  private async request(method: string, path: string, body?: any, params?: any): Promise<any> {
    const token = await this.ensureAuth();
    const cfg: any = {
      method,
      url: path,
      headers: { Authorization: `Bearer ${token}` },
    };
    if (body) cfg.data = body;
    if (params) cfg.params = params;
    try {
      const { data } = await this.axios(cfg);
      return data;
    } catch (err: any) {

      // console.log("CLIODOT", err)
      if (err?.response?.status === 401) {
        this.jwt = null;
      }
      const data = err?.response?.data;
      const msg = data?.error || data?.message || err?.message || `Request failed: ${method} ${path}`;
      throw new CliodotApiError(msg, {
        status: err?.response?.status,
        response: err?.response,
        data,
      });
    }
  }

  connectors: ConnectorsApi = {
    get: async (connectorId: string): Promise<any> => {
      const data = await this.request("GET", `/connectors/${connectorId}`);
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
    install: async (connectorId: string, options?: { auth?: any; base_url?: string }): Promise<any> => {
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
      }
    ): Promise<any> => {
      const payload: Record<string, any> = {
        body: options?.body,
        params: options?.params,
        pathParams: options?.pathParams,
        headers: options?.headers,
        installation_id: options?.installation_id,
        database: options?.database,
        connection_id: options?.connection_id,
        timeout: options?.timeout,
        vars: options?.vars,
      };
      const filtered = Object.fromEntries(Object.entries(payload).filter(([, v]) => v !== undefined));
      const data = await this.request("POST", `/connectors/${connectorId}/actions/${encodeURIComponent(action)}`, filtered);
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
    run: async (groupId: string, triggerId: string, payload: { payload?: any; environment?: "dev" | "prod" } = {}): Promise<any> => {
      const data = await this.request("POST", `/workflows/${groupId}/test/trigger/${triggerId}`, payload);
      return toFinalWorkflowResult(data);
    },
    runByWebhook: async (webhookPath: string, method: string, payload: { body?: any; environment?: "dev" | "prod" } = {}): Promise<any> => {
      const { environment, body, ...rest } = payload;
      const data = await this.request("POST", "/workflows/test/webhook", {
        webhookPath,
        webhookMethod: method,
        payload: { trigger: { data: body ?? rest } },
        ...(environment && { environment }),
      });
      return toFinalWorkflowResult(data);
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
