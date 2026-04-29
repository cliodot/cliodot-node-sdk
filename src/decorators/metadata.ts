import type { IWorkflow, IWorkflowStep, ValidationRule } from "../types/workflow";
import type { HttpMethod } from "../types/builtin";
import { WorkflowStepType, WorkflowTriggerType } from "../types/workflow";
import type {
  AuthConnectorId,
  AuthAction,
  UtilityConnectorId,
  UtilityAction,
  EncryptionConnectorId,
  EncryptionAction,
  DbEngine,
  DbAction,
  ResponderType,
} from "../types/builtin";

export type StepFactory = (id: string) => IWorkflowStep;

export type StepDecoratorOptions = {
  id?: string;
  order?: number;
  stage?: "pre" | "post";
  then?: string;
  else?: string;
};

export type ConnectorStepHeaderValue = string | number | boolean;

export type ConnectorStepHeaders =
  | Record<string, ConnectorStepHeaderValue>
  | Array<{ key: string; value: ConnectorStepHeaderValue }>;

export type ConnectorStepConfig = {
  body?: Record<string, unknown> | string | null;
  params?: Record<string, unknown>;
  pathParams?: Record<string, unknown>;
  headers?: ConnectorStepHeaders;
  vars?: Record<string, unknown>;
  timeout?: number;
  files?: unknown;
  installation_id?: string;
  connection_id?: string;
  database?: string;
  connector_version?: string;
} & Record<string, unknown>;

export type WorkflowDecoratorsTrigger = {
  type: WorkflowTriggerType;
  webhook_url?: string;
  webhookMethod?: HttpMethod;
  cron?: string;
  timezone?: string;
};

export type WorkflowDecoratorsMeta = {
  workflowId?: string;
  workflowName?: string;
  trigger?: WorkflowDecoratorsTrigger;
  steps: Array<{
    stepId: string;
    methodKey: string;
    orderKey: number;
    stage?: "pre" | "post";
    then?: string;
    else?: string;
    factory: StepFactory;
  }>;
};

export const WORKFLOW_META_KEY = Symbol.for("cliodot:workflowMeta");
export const CONNECTOR_META_KEY = Symbol.for("cliodot:connectorMeta");

export type ConnectorActionMeta = {
  actionName: string;
  methodKey: string;
  type: "endpoint" | "custom";
  httpConfig?: {
    method: HttpMethod;
    path: string;
    [key: string]: any;
  };
};

export type ConnectorDecoratorsMeta = {
  connectorId?: string;
  connectorName?: string;
  config?: any;
  actions: ConnectorActionMeta[];
};

export function getOrCreateWorkflowMeta(ctor: any): WorkflowDecoratorsMeta {
  if (!ctor[WORKFLOW_META_KEY]) {
    ctor[WORKFLOW_META_KEY] = { steps: [] } satisfies WorkflowDecoratorsMeta;
  }
  return ctor[WORKFLOW_META_KEY] as WorkflowDecoratorsMeta;
}

export function getOrCreateConnectorMeta(ctor: any): ConnectorDecoratorsMeta {
  if (!ctor[CONNECTOR_META_KEY]) {
    ctor[CONNECTOR_META_KEY] = { actions: [] } satisfies ConnectorDecoratorsMeta;
  }
  return ctor[CONNECTOR_META_KEY] as ConnectorDecoratorsMeta;
}

export function sanitizeStepId(id: string): string {
  return id.replace(/[.\-\s]/g, "_");
}

export function inferWorkflowIdFromClassName(className: string): string {
  const raw = className.replace(/Workflow$/i, "").replace(/_/g, " ").trim();
  const kebab = raw
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/\s+/g, "-")
    .toLowerCase();
  return sanitizeStepId(kebab);
}

export function withThenElse(step: IWorkflowStep, thenId?: string, elseId?: string): IWorkflowStep {
  const then = thenId ? sanitizeStepId(thenId) : undefined;
  const elseStep = elseId ? sanitizeStepId(elseId) : undefined;
  if (then) (step as any).then = then;
  if (elseStep) (step as any).else = elseStep;
  return step;
}

const CONNECTOR_STEP_RESERVED = new Set([
  "body",
  "params",
  "pathParams",
  "headers",
  "vars",
  "timeout",
  "files",
  "installation_id",
  "connection_id",
  "database",
  "connector_version",
]);

export function makeConnectorStep(
  id: string,
  connectorId: string,
  action: string,
  config: ConnectorStepConfig = {} as ConnectorStepConfig
): IWorkflowStep {
  const c = config as Record<string, unknown>;
  const explicitBody = c.body;
  const params = c.params;
  const pathParams = c.pathParams;
  const headers = c.headers;
  const vars = c.vars;
  const timeout = c.timeout;
  const files = c.files;
  const installation_id = c.installation_id;
  const connection_id = c.connection_id;
  const database = c.database;
  const connector_version = c.connector_version;

  const rest: Record<string, unknown> = {};
  for (const k of Object.keys(c)) {
    if (!CONNECTOR_STEP_RESERVED.has(k)) rest[k] = c[k];
  }

  const body =
    explicitBody !== undefined
      ? explicitBody
      : Object.keys(rest).length > 0
        ? rest
        : undefined;

  const step: any = {
    id,
    type: WorkflowStepType.API_CALL,
    connector_id: connectorId,
    action,
  };
  if (params !== undefined) step.params = params;
  if (pathParams !== undefined) step.pathParams = pathParams;
  if (headers !== undefined) step.headers = headers;
  if (vars !== undefined) step.vars = vars;
  if (timeout !== undefined) step.timeout = timeout;
  if (files !== undefined) step.files = files;
  if (installation_id !== undefined) step.installation_id = installation_id;
  if (connection_id !== undefined) step.connection_id = connection_id;
  if (database !== undefined) step.database = database;
  if (connector_version !== undefined && connector_version !== "")
    step.connector_version = String(connector_version);
  if (body !== undefined) step.body = body;
  return step;
}

export function makeDbStep(
  id: string,
  engine: DbEngine,
  action: DbAction,
  config: Record<string, any>
): IWorkflowStep {
  const connectorId = engine === "mongodb" ? "mongodb.system" : "mysql.system";
  const { connector_version: cvDb, connection_id, database, ...bodyPayload } = config;
  const step: any = {
    id,
    type: WorkflowStepType.DB,
    connector_id: connectorId,
    action,
    body: bodyPayload,
    params: bodyPayload.params,
  };
  if (connection_id) step.connection_id = connection_id;
  if (database) step.database = database;
  if (cvDb != null && String(cvDb).trim() !== "") {
    step.connector_version = String(cvDb).trim();
  }
  return step;
}

export function makeValidatorStep(
  id: string,
  fieldsOrGroups:
    | Record<string, string>
    | Array<{
        fields: string[];
        validators: Array<ValidationRule>;
      }>
): IWorkflowStep {
  let validationGroups: Array<{
    fields: string[];
    validators: Array<ValidationRule>;
  }>;
  if (Array.isArray(fieldsOrGroups)) {
    validationGroups = fieldsOrGroups;
  } else {
    validationGroups = [
      {
        fields: Object.values(fieldsOrGroups),
        validators: Object.entries(fieldsOrGroups).map(() => ({ name: "required" as const, config: {} })),
      },
    ];
  }

  return {
    id,
    type: WorkflowStepType.VALIDATOR,
    validationGroups: validationGroups.map((g) => ({
      fields: g.fields,
      validators: g.validators.map((v) => ({
        name: v.name,
        config: v.config ?? {},
      })),
    })),
  } as any;
}

export function makeConditionStep(id: string, expr: string): IWorkflowStep {
  return {
    id,
    type: WorkflowStepType.CONDITION,
    mode: "jexl",
    if: expr,
  } as any;
}

export function makeTransformStep(
  id: string,
  mappingOrOperations: Record<string, string> | Record<string, any>[]
): IWorkflowStep {
  const isMapping = !Array.isArray(mappingOrOperations);
  return {
    id,
    type: WorkflowStepType.TRANSFORM,
    ...(isMapping
      ? { mapping: mappingOrOperations as Record<string, string> }
      : { operations: mappingOrOperations as Record<string, any>[] }),
  } as any;
}

export function makeResponderStep(
  id: string,
  type: ResponderType,
  config: {
    statusCode?: number;
    headers?: Record<string, string>;
    body?: any;
    contentType?: string;
    location?: string;
  }
): IWorkflowStep {
  return {
    id,
    type: WorkflowStepType.RESPONDER,
    responder: type,
    config: {
      statusCode: config.statusCode ?? 200,
      headers: config.headers,
      body: config.body,
      contentType: config.contentType,
      location: config.location,
    },
  } as any;
}

export function makeAuthStep(
  id: string,
  connectorId: AuthConnectorId,
  action: AuthAction,
  config: Record<string, any>
): IWorkflowStep {
  const { connector_version: cvAuth, ...payload } = config;
  const step: any = {
    id,
    type: WorkflowStepType.AUTHENTICATION,
    connector_id: connectorId,
    action,
    params: payload,
    body: payload,
  };
  if (cvAuth != null && String(cvAuth).trim() !== "") {
    step.connector_version = String(cvAuth).trim();
  }
  return step as any;
}

export function makeEncryptStep(
  id: string,
  connectorId: EncryptionConnectorId,
  action: EncryptionAction,
  config: Record<string, any>
): IWorkflowStep {
  const { connector_version: cvEnc, ...payload } = config;
  const step: any = {
    id,
    type: WorkflowStepType.ENCRYPTION,
    connector_id: connectorId,
    action,
    params: payload,
    body: payload,
  };
  if (cvEnc != null && String(cvEnc).trim() !== "") {
    step.connector_version = String(cvEnc).trim();
  }
  return step as any;
}

export function makeCodeStep(
  id: string,
  sourceOrModule: string,
  fn?: string,
  args?: Record<string, any>,
  config?: { input_from?: string; timeout?: number }
): IWorkflowStep {
  const isModule = !fn && !sourceOrModule.includes("return") && !sourceOrModule.includes("{{");
  return {
    id,
    type: WorkflowStepType.CODE,
    ...(isModule
      ? { module_ref: sourceOrModule, fn: fn || "execute", args: args || {} }
      : { source: sourceOrModule, args: args || {} }),
    input_from: config?.input_from,
    timeout: config?.timeout ?? 1000,
  } as any;
}

export function makeCallStep(id: string, functionSlugOrId: string, args: Record<string, any>): IWorkflowStep {
  return {
    id,
    type: WorkflowStepType.FUNCTION,
    function_id: functionSlugOrId,
    function_slug: functionSlugOrId,
    args,
  } as any;
}

export function makeCallWorkflowStep(
  id: string,
  workflowId: string,
  payload?: Record<string, any>,
  webhook?: { path: string; method: string }
): IWorkflowStep {
  const raw = payload ?? {};
  const trigger_id = (raw.trigger_id ?? raw.triggerId) as string | undefined;
  const environment = raw.environment as "dev" | "prod" | undefined;
  const executionHeaders = (raw.executionHeaders ?? raw.execution_headers) as Record<string, string> | undefined;
  const remote = raw.remote === true;
  const child_workflow_name = (raw.child_workflow_name ?? raw.workflow_name) as string | undefined;
  const rest: Record<string, any> = { ...raw };
  for (const k of [
    "trigger_id",
    "triggerId",
    "environment",
    "executionHeaders",
    "execution_headers",
    "remote",
    "child_workflow_name",
    "workflow_name",
    "webhook_path",
    "webhookPath",
    "webhook_method",
    "webhookMethod",
  ]) {
    delete rest[k];
  }
  const wFromRaw =
    raw.webhook_path || raw.webhookPath
      ? {
          path: String(raw.webhook_path ?? raw.webhookPath).trim(),
          method: String(raw.webhook_method ?? raw.webhookMethod ?? "POST").toUpperCase(),
        }
      : undefined;
  const webhookResolved = webhook?.path
    ? { path: webhook.path.trim(), method: (webhook.method ?? "POST").toUpperCase() }
    : wFromRaw;

  const step: any = {
    id,
    type: WorkflowStepType.CALL_WORKFLOW,
    payload: Object.keys(rest).length ? rest : {},
  };
  if (workflowId) step.workflow_id = workflowId;
  if (webhookResolved?.path) {
    step.webhook_path = webhookResolved.path;
    step.webhook_method = webhookResolved.method;
  }
  if (!step.workflow_id && !step.webhook_path) {
    throw new Error("CallWorkflow requires a workflow group id, or a webhook path, or both in payload");
  }
  if (trigger_id) step.trigger_id = trigger_id;
  if (environment) step.environment = environment;
  if (executionHeaders && Object.keys(executionHeaders).length > 0) step.execution_headers = executionHeaders;
  if (remote) step.remote = true;
  if (child_workflow_name) step.child_workflow_name = child_workflow_name;
  return step;
}

export function makeLoopStep(
  id: string,
  over: string,
  steps: IWorkflowStep[],
  config?: { as?: string; index_as?: string; max_iterations?: number }
): IWorkflowStep {
  return {
    id,
    type: WorkflowStepType.LOOP,
    over,
    as: config?.as ?? "item",
    index_as: config?.index_as ?? "index",
    steps,
    max_iterations: config?.max_iterations ?? 1000,
  } as any;
}

export function makeLogStep(id: string, message: string): IWorkflowStep {
  return { id, type: WorkflowStepType.LOG, message } as any;
}

export function makeDelayStep(id: string, ms: number): IWorkflowStep {
  return { id, type: WorkflowStepType.DELAY, ms } as any;
}

export function makeNotifyStep(id: string, channel: string, message: string): IWorkflowStep {
  return { id, type: WorkflowStepType.NOTIFY, channel, message } as any;
}

export function makeCustomStep(id: string): IWorkflowStep {
  return {
    id,
    type: WorkflowStepType.CUSTOM,
  } as any;
}

