import {
  IWorkflow,
  IWorkflowStep,
  IWorkflowTrigger,
  WorkflowStepType,
  WorkflowTriggerType,
} from "./types/workflow";
import type {
  AuthConnectorId,
  AuthActionForConnector,
  AuthConfigFor,
  UtilityConnectorId,
  UtilityAction,
  EncryptionConnectorId,
  EncryptionAction,
  DbEngine,
  DbAction,
  HttpMethod,
  ResponderType,
} from "./types/builtin";
import { makeConnectorStep } from "./decorators/metadata";
import type { ConnectorStepConfig } from "./decorators/metadata";
import {
  isTypedConnectorDef,
  type TypedConnectorDef,
  type ConnectorTypedRequestConfig,
  type ConnectorActionSchema,
} from "./connectors/registry";

export interface StepResult {
  step: IWorkflowStep;
  then(stepId: string): StepResult;
  else(stepId: string): StepResult;
}

function createStepResult(step: IWorkflowStep): StepResult {
  return {
    step,
    then(stepId: string) {
      (this.step as any).then = stepId.replace(/[.\-\s]/g, "_");
      return this;
    },
    else(stepId: string) {
      (this.step as any).else = stepId.replace(/[.\-\s]/g, "_");
      return this;
    },
  };
}

type StepBuilderFn = (s: StepBuilder) => StepResult | IWorkflowStep;

export class StepBuilder {
  connector<
    TActions extends Record<string, string>,
    TSchemas extends Record<string, ConnectorActionSchema>,
    TKey extends keyof TActions,
  >(
    connectorDef: TypedConnectorDef<TActions, TSchemas>,
    actionKey: TKey,
    config?: ConnectorTypedRequestConfig<TypedConnectorDef<TActions, TSchemas>, TKey>
  ): StepResult;
  connector(
    connectorId: string,
    action: string,
    config?: ConnectorStepConfig
  ): StepResult;
  connector(
    connectorIdOrDef: string | TypedConnectorDef<any, any>,
    actionOrKey: string,
    config?: ConnectorStepConfig
  ): StepResult {
    const resolved = (config ?? {}) as ConnectorStepConfig;
    let connectorId: string;
    let action: string;
    if (isTypedConnectorDef(connectorIdOrDef)) {
      connectorId = connectorIdOrDef.id;
      const key = actionOrKey as keyof typeof connectorIdOrDef.actions;
      const mapped = connectorIdOrDef.actions[key];
      if (typeof mapped !== "string") {
        throw new Error(`Unknown action key on connector ${connectorId}: ${String(actionOrKey)}`);
      }
      action = mapped;
    } else {
      connectorId = connectorIdOrDef as string;
      action = actionOrKey;
    }
    const step = makeConnectorStep("", connectorId, action, resolved);
    return createStepResult(step as IWorkflowStep);
  }

  db(
    engine: DbEngine,
    action: DbAction,
    config: Record<string, any>
  ): StepResult {
    const connectorId = engine === "mongodb" ? "mongodb.system" : "mysql.system";
    const step: IWorkflowStep = {
      id: "",
      type: WorkflowStepType.DB,
      connector_id: connectorId,
      action,
      body: config,
      params: config.params,
    } as any;
    if (config.connection_id) (step as any).connection_id = config.connection_id;
    if (config.database) (step as any).database = config.database;
    return createStepResult(step);
  }

  validator(fieldsOrGroups: Record<string, string> | Array<{ fields: string[]; validators: Array<{ name: string; config?: Record<string, any> }> }>): StepResult {
    let validationGroups: Array<{ fields: string[]; validators: Array<{ name: string; config?: Record<string, any> }> }>;
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
    const step: IWorkflowStep = {
      id: "",
      type: WorkflowStepType.VALIDATOR,
      validationGroups,
    } as any;
    return createStepResult(step);
  }

  condition(expr: string): StepResult {
    const step: IWorkflowStep = {
      id: "",
      type: WorkflowStepType.CONDITION,
      mode: "jexl",
      if: expr,
    } as any;
    return createStepResult(step);
  }

  loop(over: string, steps: IWorkflowStep[], config?: { as?: string; index_as?: string; max_iterations?: number }): StepResult {
    const step: IWorkflowStep = {
      id: "",
      type: WorkflowStepType.LOOP,
      over,
      as: config?.as ?? "item",
      index_as: config?.index_as ?? "index",
      steps,
      max_iterations: config?.max_iterations ?? 1000,
    } as any;
    return createStepResult(step);
  }

  code(
    sourceOrModule: string,
    fn?: string,
    args?: Record<string, any>,
    config?: { input_from?: string; timeout?: number }
  ): StepResult {
    const isModule = !fn && !sourceOrModule.includes("return") && !sourceOrModule.includes("{{");
    const step: IWorkflowStep = {
      id: "",
      type: WorkflowStepType.CODE,
      ...(isModule
        ? { module_ref: sourceOrModule, fn: fn || "execute", args: args || {} }
        : { source: sourceOrModule, args: args || {} }),
      input_from: config?.input_from,
      timeout: config?.timeout ?? 1000,
    } as any;
    return createStepResult(step);
  }

  call(
    functionSlugOrId: string,
    args: Record<string, any>
  ): StepResult {
    const step: IWorkflowStep = {
      id: "",
      type: WorkflowStepType.FUNCTION,
      function_id: functionSlugOrId,
      function_slug: functionSlugOrId,
      args,
    } as any;
    return createStepResult(step);
  }

  callWorkflow(workflowId: string, payload?: Record<string, any>): StepResult {
    const step: IWorkflowStep = {
      id: "",
      type: WorkflowStepType.CALL_WORKFLOW,
      workflow_id: workflowId,
      payload: payload ?? {},
    } as any;
    return createStepResult(step);
  }

  auth<
    TConnectorId extends AuthConnectorId,
    TAction extends AuthActionForConnector<TConnectorId>,
  >(
    connectorId: TConnectorId,
    action: TAction,
    config: AuthConfigFor<TConnectorId, TAction>
  ): StepResult {
    const step: IWorkflowStep = {
      id: "",
      type: WorkflowStepType.AUTHENTICATION,
      connector_id: connectorId,
      action,
      params: config,
      body: config,
    } as any;
    return createStepResult(step);
  }

  util(
    connectorId: UtilityConnectorId,
    action: UtilityAction,
    config: Record<string, any>
  ): StepResult {
    return this.connector(connectorId, action, config);
  }

  transform(
    mappingOrOperations: Record<string, string> | Record<string, any>[]
  ): StepResult {
    const isMapping = !Array.isArray(mappingOrOperations);
    const step: IWorkflowStep = {
      id: "",
      type: WorkflowStepType.TRANSFORM,
      ...(isMapping
        ? { mapping: mappingOrOperations as Record<string, string> }
        : { operations: mappingOrOperations as Record<string, any>[] }),
    } as any;
    return createStepResult(step);
  }

  encrypt(
    connectorId: EncryptionConnectorId,
    action: EncryptionAction,
    config: Record<string, any>
  ): StepResult {
    const step: IWorkflowStep = {
      id: "",
      type: WorkflowStepType.ENCRYPTION,
      connector_id: connectorId,
      action,
      params: config,
      body: config,
    } as any;
    return createStepResult(step);
  }

  responder(
    type: ResponderType,
    config: { statusCode?: number; headers?: Record<string, string>; body?: any; contentType?: string; location?: string }
  ): StepResult {
    const step: IWorkflowStep = {
      id: "",
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
    return createStepResult(step);
  }

  log(message: string): StepResult {
    const step: IWorkflowStep = {
      id: "",
      type: WorkflowStepType.LOG,
      message,
    } as any;
    return createStepResult(step);
  }

  delay(ms: number): StepResult {
    const step: IWorkflowStep = {
      id: "",
      type: WorkflowStepType.DELAY,
      ms,
    } as any;
    return createStepResult(step);
  }

  notify(channel: string, message: string): StepResult {
    const step: IWorkflowStep = {
      id: "",
      type: WorkflowStepType.NOTIFY,
      channel,
      message,
    } as any;
    return createStepResult(step);
  }
}

function sanitizeStepId(id: string): string {
  return id.replace(/[.\-\s]/g, "_");
}

export class WorkflowBuilder {
  private workflowId: string;
  private workflowName: string;
  private trigger: IWorkflowTrigger = { type: WorkflowTriggerType.MANUAL };
  private steps: IWorkflowStep[] = [];
  private stepOrder: string[] = [];

  constructor(workflowId: string, workflowName?: string) {
    this.workflowId = workflowId;
    this.workflowName = workflowName || workflowId;
  }

  http(method: HttpMethod, path: string): this {
    this.trigger = {
      type: WorkflowTriggerType.HTTP,
      webhook_url: path,
    };
    (this.trigger as any).webhookMethod = method;
    return this;
  }

  webhook(method: HttpMethod, path: string): this {
    return this.http(method, path);
  }

  job(cron?: string, timezone?: string): this {
    this.trigger = {
      type: WorkflowTriggerType.JOB,
      cron: cron ?? "* * * * *",
      timezone,
    };
    return this;
  }

  schedule(cron: string, timezone?: string): this {
    this.trigger = {
      type: WorkflowTriggerType.SCHEDULE,
      cron,
      timezone,
    };
    return this;
  }

  step(stepId: string, fn: StepBuilderFn): this {
    const s = new StepBuilder();
    const result = fn(s);
    const rawStep = (result as any).step !== undefined ? (result as StepResult).step : result;
    if (!rawStep || typeof rawStep !== "object") throw new Error(`Step ${stepId} did not produce a valid step`);
    const sanitizedId = sanitizeStepId(stepId);
    const fullStep: IWorkflowStep = {
      ...rawStep,
      id: sanitizedId,
    } as IWorkflowStep;
    this.steps.push(fullStep);
    this.stepOrder.push(stepId);
    return this;
  }

  build(): IWorkflow {
    const stepsWithInputFrom: IWorkflowStep[] = [];
    for (let i = 0; i < this.steps.length; i++) {
      const step = { ...this.steps[i] };
      if (i > 0) {
        step.input_from = sanitizeStepId(this.stepOrder[i - 1]);
      }
      stepsWithInputFrom.push(step);
    }
    return {
      _id: sanitizeStepId(this.workflowId),
      name: this.workflowName,
      trigger: this.trigger,
      steps: stepsWithInputFrom,
      status: "active",
    };
  }
}
