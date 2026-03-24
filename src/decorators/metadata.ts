import type { IWorkflow, IWorkflowStep } from "../types/workflow";
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

export function getOrCreateWorkflowMeta(ctor: any): WorkflowDecoratorsMeta {
  if (!ctor[WORKFLOW_META_KEY]) {
    ctor[WORKFLOW_META_KEY] = { steps: [] } satisfies WorkflowDecoratorsMeta;
  }
  return ctor[WORKFLOW_META_KEY] as WorkflowDecoratorsMeta;
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

export function makeConnectorStep(
  id: string,
  connectorId: string,
  action: string,
  config: Record<string, any> = {}
): IWorkflowStep {
  const { body, params, pathParams, ...rest } = config;
  return {
    id,
    type: WorkflowStepType.API_CALL,
    connector_id: connectorId,
    action,
    params: params || rest,
    pathParams: pathParams || params || rest,
    body: body ?? rest,
  } as any;
}

export function makeDbStep(
  id: string,
  engine: DbEngine,
  action: DbAction,
  config: Record<string, any>
): IWorkflowStep {
  const connectorId = engine === "mongodb" ? "mongodb.system" : "mysql.system";
  const step: any = {
    id,
    type: WorkflowStepType.DB,
    connector_id: connectorId,
    action,
    body: config,
    params: config.params,
  };
  if (config.connection_id) step.connection_id = config.connection_id;
  if (config.database) step.database = config.database;
  return step;
}

export function makeValidatorStep(
  id: string,
  fieldsOrGroups:
    | Record<string, string>
    | Array<{
        fields: string[];
        validators: Array<{ name: string; config?: Record<string, any> }>;
      }>
): IWorkflowStep {
  let validationGroups: Array<{
    fields: string[];
    validators: Array<{ name: string; config?: Record<string, any> }>;
  }>;
  if (Array.isArray(fieldsOrGroups)) {
    validationGroups = fieldsOrGroups;
  } else {
    validationGroups = [
      {
        fields: Object.values(fieldsOrGroups),
        validators: Object.entries(fieldsOrGroups).map(() => ({ name: "required", config: {} })),
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
  return {
    id,
    type: WorkflowStepType.AUTHENTICATION,
    connector_id: connectorId,
    action,
    params: config,
    body: config,
  } as any;
}

export function makeEncryptStep(
  id: string,
  connectorId: EncryptionConnectorId,
  action: EncryptionAction,
  config: Record<string, any>
): IWorkflowStep {
  return {
    id,
    type: WorkflowStepType.ENCRYPTION,
    connector_id: connectorId,
    action,
    params: config,
    body: config,
  } as any;
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
  payload?: Record<string, any>
): IWorkflowStep {
  return {
    id,
    type: WorkflowStepType.CALL_WORKFLOW,
    workflow_id: workflowId,
    payload: payload ?? {},
  } as any;
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

