import { IWorkflow } from "./types/workflow";
import { IFunction } from "./types/function";
import { WorkflowBuilder } from "./WorkflowBuilder";
import { FunctionBuilder } from "./FunctionBuilder";
import { ProcessorEngine } from "./runner/ProcessorEngine";
import { createCliodotConnector } from "./connectors/builtin";
import { FlosyncClient } from "./FlosyncClient";
import { buildWorkflowFromClass } from "./decorators/build";
import {
  isTypedConnectorDef,
  type TypedConnectorDef,
  type ConnectorRunOptionsTyped,
  type ConnectorActionSchema,
} from "./connectors/registry";

export interface FlosyncConfig {
  apiKey?: string;
  apiSecret?: string;
  baseUrl?: string;
  projectId?: string;
  tenantId?: string;
  connectors?: Record<string, any>;
  cliodot?: { baseUrl: string; apiKey: string };
  tokenRefreshMarginMs?: number;
  tokenFallbackReuseMs?: number;
  debug?: boolean;
}

export class Flosync {
  private config: FlosyncConfig = {};
  private workflows: Map<string, IWorkflow> = new Map();
  private workflowsByName: Map<string, IWorkflow> = new Map();
  private functions: Map<string, any> = new Map();
  private connectors: Map<string, any> = new Map();

  configure(config: FlosyncConfig): this {
    this.config = { ...this.config, ...config };
    const connectorConfig = config.connectors || {};
    const cliodot = config.cliodot;
    if (cliodot?.baseUrl && cliodot?.apiKey) {
      this.connectors.set("cliodot", createCliodotConnector({ baseUrl: cliodot.baseUrl, apiKey: cliodot.apiKey }));
    }
    if (config.apiKey && config.apiSecret) {
      const existing = (this as any).client;
      if (!existing) {
        (this as any).client = new FlosyncClient({
          baseUrl: this.config.baseUrl,
          apiKey: this.config.apiKey!,
          apiSecret: this.config.apiSecret!,
          tokenRefreshMarginMs: this.config.tokenRefreshMarginMs,
          tokenFallbackReuseMs: this.config.tokenFallbackReuseMs,
          debug: this.config.debug,
        });
      }
    }
    const runner = new ProcessorEngine({
      workflows: this.workflows,
      functions: this.functions,
      connectors: this.connectors,
      connectorConfig,
      client: (this as any).client,
    });
    (this as any).runner = runner;
    return this;
  }

  async authenticate(): Promise<void> {
    const client = this.getClient();
    if (client) {
      await client.authenticate();
    }
  }

  registerConnector(id: string, connector: any): this {
    this.connectors.set(id, connector);
    return this;
  }

  workflow(id: string, name?: string): WorkflowBuilder {
    return new WorkflowBuilder(id, name);
  }

  function(id: string, name?: string): FunctionBuilder {
    return new FunctionBuilder(id, name);
  }

  register(workflowOrWorkflows: IWorkflow | IWorkflow[]): this {
    const list = Array.isArray(workflowOrWorkflows) ? workflowOrWorkflows : [workflowOrWorkflows];
    for (const w of list) {
      this.workflows.set(w._id, w);
      this.workflowsByName.set(w.name, w);
      const rawId = (w as any).__rawId;
      if (rawId && rawId !== w._id) this.workflows.set(rawId, w);
    }
    return this;
  }

  registerFromClass(workflowClass: any): this {
    const workflow = buildWorkflowFromClass(workflowClass);
    return this.register(workflow);
  }

  async run(workflowIdOrName: string, payload: any = {}, options?: { remote?: boolean }): Promise<any> {
    const workflow = this.workflows.get(workflowIdOrName) ?? this.workflowsByName.get(workflowIdOrName);
    if (workflow) {
      const runner = (this as any).runner;
      if (!runner) throw new Error("LocalRunner not initialized. Call flosync.configure() first.");
      const normalized = this.normalizeRunPayload(payload);
      if (this.config.debug) normalized.debug = true;
      return runner.runWorkflow(workflow, normalized);
    }
    const client = this.getClient();
    if (client && (options?.remote ?? true)) {
      return this.runById(workflowIdOrName, payload);
    }
    throw new Error(`Workflow not found: ${workflowIdOrName}`);
  }

  async runById(workflowId: string, payload: any = {}, options?: { triggerId?: string }): Promise<any> {
    const client = this.getClient();
    if (!client) throw new Error("FlosyncClient not configured. Set apiKey and apiSecret for remote run.");
    const triggerId = options?.triggerId ?? "trigger";
    const normalized = this.normalizeRunPayload(payload);
    return client.workflows.run(workflowId, triggerId, { payload: normalized });
  }

  async runByWebhook(webhookPath: string, method: string, payload: any = {}): Promise<any> {
    const client = this.getClient();
    if (!client) throw new Error("FlosyncClient not configured. Set apiKey and apiSecret for remote run.");
    return client.workflows.runByWebhook(webhookPath, method, payload);
  }

  async runFunctionById(functionId: string, args: Record<string, any> = {}): Promise<any> {
    const client = this.getClient();
    if (!client) throw new Error("FlosyncClient not configured. Set apiKey and apiSecret for remote invoke.");
    return client.functions.invoke(functionId, args);
  }

  async runConnector<
    TActions extends Record<string, string>,
    TSchemas extends Record<string, ConnectorActionSchema>,
    TKey extends keyof TActions,
  >(
    connectorDef: TypedConnectorDef<TActions, TSchemas>,
    actionKey: TKey,
    options?: ConnectorRunOptionsTyped<TypedConnectorDef<TActions, TSchemas>, TKey>,
    runOptions?: { remote?: boolean }
  ): Promise<any>;
  async runConnector(
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
    },
    runOptions?: { remote?: boolean }
  ): Promise<any>;
  async runConnector(
    connectorIdOrDef: string | TypedConnectorDef<any, any>,
    actionOrKey: string,
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
    },
    runOptions?: { remote?: boolean }
  ): Promise<any> {
    if (isTypedConnectorDef(connectorIdOrDef)) {
      const def = connectorIdOrDef;
      const key = actionOrKey as keyof typeof def.actions;
      const mapped = def.actions[key];
      if (typeof mapped !== "string") {
        throw new Error(`Unknown connector action key: ${String(actionOrKey)}`);
      }
      return this.runConnector(def.id, mapped, options, runOptions);
    }
    const connectorId = connectorIdOrDef as string;
    const action = actionOrKey;
    const connector = this.connectors.get(connectorId);
    if (connector && (runOptions?.remote ?? false) === false) {
      const runner = (this as any).runner;
      if (runner) {
        const state = {
          headers: options?.headers ?? {},
          connectorConfig: this.config.connectors ?? {},
          env: {},
          trigger: { body: options?.body, data: options?.body },
          stepResults: {},
          vars: options?.vars ?? {},
        };
        const { executeConnectorAction } = require("./runner/connector.executor");
        const result = await executeConnectorAction(connector, action, {
          body: options?.body,
          params: options?.params,
          pathParams: options?.pathParams,
          headers: options?.headers,
          database: options?.database,
          connection_id: options?.connection_id,
          timeout: options?.timeout,
        }, state);
        const out = result?.mapped ?? result?.raw ?? result;
        return out;
      }
    }
    const client = this.getClient();
    if (client && (runOptions?.remote ?? true)) {
      return client.connectors.execute(connectorId, action, options);
    }
    throw new Error(
      `Connector ${connectorId} not found locally. Configure apiKey and apiSecret to run connectors from your Cliodot account.`
    );
  }

  private normalizeRunPayload(payload: any): any {
    if (!payload || typeof payload !== "object") return { trigger: { data: payload, body: payload } };
    if (Array.isArray(payload)) return { trigger: { data: payload, body: payload } };
    const passthroughKeys = ["headers", "pathParams", "path_params", "params", "query", "vars", "envVars", "env_vars", "env", "trigger", "callStack", "call_stack"];
    const hasExplicitBody = "body" in payload || "data" in payload || (payload.trigger && ("body" in payload.trigger || "data" in payload.trigger));
    let data: any;
    if (hasExplicitBody) {
      data = payload.body ?? payload.data ?? payload.trigger?.body ?? payload.trigger?.data;
    } else {
      const bodyLike = Object.fromEntries(Object.entries(payload).filter(([k]) => !passthroughKeys.includes(k)));
      data = Object.keys(bodyLike).length > 0 ? bodyLike : payload;
    }
    const trigger = payload.trigger ?? {};
    return {
      body: data,
      data: data,
      trigger: { ...trigger, data: trigger.data ?? data, body: trigger.body ?? data },
      headers: payload.headers ?? trigger.headers ?? {},
      pathParams: payload.pathParams ?? payload.path_params ?? trigger.pathParams ?? {},
      params: payload.params ?? trigger.params ?? {},
      query: payload.query ?? trigger.query ?? {},
      vars: payload.vars ?? trigger.vars ?? {},
      envVars: payload.envVars ?? payload.env_vars ?? payload.env ?? {},
      callStack: payload.callStack ?? payload.call_stack ?? [],
    };
  }

  setRunner(runner: any): this {
    (this as any).runner = runner;
    return this;
  }

  getClient(): FlosyncClient | null {
    return (this as any).client ?? null;
  }

  get c(): FlosyncClient | null {
    return this.getClient();
  }

  setClient(client: any): this {
    (this as any).client = client;
    return this;
  }

  async push(workflow: IWorkflow): Promise<any> {
    const client = this.getClient();
    if (!client) throw new Error("FlosyncClient not configured. Set apiKey and apiSecret in configure().");
    return client.workflows.push(workflow);
  }

  async pull(workflowId: string): Promise<IWorkflow> {
    const client = this.getClient();
    if (!client) throw new Error("FlosyncClient not configured. Set apiKey and apiSecret in configure().");
    const wf = await client.workflows.pull(workflowId);
    this.register(wf);
    return wf;
  }

  list(): IWorkflow[] {
    return Array.from(this.workflows.values());
  }

  registerFunction(fn: IFunction): this {
    const id = fn._id || fn.slug || fn.name;
    if (!id) throw new Error("Function must have _id, slug, or name");
    this.functions.set(id, fn);
    if (fn.slug && fn.slug !== id) this.functions.set(fn.slug, fn);
    if (fn.name && fn.name !== id) this.functions.set(fn.name, fn);
    const rawId = (fn as any).__rawId;
    if (rawId && rawId !== id) this.functions.set(rawId, fn);
    return this;
  }

  async runFunction(slugOrId: string, args: Record<string, any> = {}, options?: { remote?: boolean }): Promise<any> {
    const fn = this.functions.get(slugOrId);
    if (fn) {
      const runner = (this as any).runner;
      if (!runner) throw new Error("LocalRunner not initialized. Call flosync.configure() first.");
      const result = await runner.runFunction(fn, args);
      if (!result.ok) throw new Error(result.error || "Function execution failed");
      return result.data;
    }
    const client = this.getClient();
    if (client && (options?.remote ?? true)) {
      return this.runFunctionById(slugOrId, args);
    }
    throw new Error(`Function not found: ${slugOrId}`);
  }

  async pushFunction(fn: IFunction): Promise<any> {
    const client = this.getClient();
    if (!client) throw new Error("FlosyncClient not configured. Set apiKey and apiSecret in configure().");
    return client.functions.push(fn);
  }

  async pullFunction(functionId: string): Promise<IFunction> {
    const client = this.getClient();
    if (!client) throw new Error("FlosyncClient not configured. Set apiKey and apiSecret in configure().");
    return client.functions.pull(functionId);
  }
}

export const flosync = new Flosync();
