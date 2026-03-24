import type { DbAction, DbEngine, EncryptionAction, EncryptionConnectorId, ResponderType } from "../types/builtin";
import type {
  AuthAction,
  AuthConnectorId,
  UtilityAction,
  UtilityConnectorId,
} from "../types/builtin";
import type { IWorkflowStep } from "../types/workflow";
import {
  getOrCreateWorkflowMeta,
  makeAuthStep,
  makeCallWorkflowStep,
  makeCallStep,
  makeCodeStep,
  makeConnectorStep,
  makeConditionStep,
  makeDelayStep,
  makeDbStep,
  makeEncryptStep,
  makeLoopStep,
  makeLogStep,
  makeNotifyStep,
  makeResponderStep,
  makeTransformStep,
  makeValidatorStep,
  type StepDecoratorOptions,
} from "./metadata";
import type { StepFactory } from "./metadata";

export function Connector(
  connectorId: string,
  action: string,
  config: Record<string, any> = {},
  options: StepDecoratorOptions = {}
) {
  return function (target: any, propertyKey: string) {
    const meta = getOrCreateWorkflowMeta(target.constructor);
    const stepId = options.id ?? propertyKey;
    const orderKey = options.order ?? meta.steps.length;
    const factory: StepFactory = (id) => makeConnectorStep(id, connectorId, action, config);
    meta.steps.push({ stepId, methodKey: propertyKey, orderKey, stage: options.stage, then: options.then, else: options.else, factory });
  };
}

export function Util(
  connectorId: UtilityConnectorId,
  action: UtilityAction,
  config: Record<string, any> = {},
  options: StepDecoratorOptions = {}
) {
  return Connector(connectorId, action, config, options) as any;
}

export function Db(
  engine: DbEngine,
  action: DbAction,
  config: Record<string, any>,
  options: StepDecoratorOptions = {}
) {
  return function (target: any, propertyKey: string) {
    const meta = getOrCreateWorkflowMeta(target.constructor);
    const stepId = options.id ?? propertyKey;
    const orderKey = options.order ?? meta.steps.length;
    const factory: StepFactory = (id) => makeDbStep(id, engine, action, config);
    meta.steps.push({ stepId, methodKey: propertyKey, orderKey, stage: options.stage, then: options.then, else: options.else, factory });
  };
}

export function Validator(
  fieldsOrGroups:
    | Record<string, string>
    | Array<{
        fields: string[];
        validators: Array<{ name: string; config?: Record<string, any> }>;
      }>,
  options: StepDecoratorOptions = {}
) {
  return function (target: any, propertyKey: string) {
    const meta = getOrCreateWorkflowMeta(target.constructor);
    const stepId = options.id ?? propertyKey;
    const orderKey = options.order ?? meta.steps.length;
    const factory: StepFactory = (id) => makeValidatorStep(id, fieldsOrGroups);
    meta.steps.push({ stepId, methodKey: propertyKey, orderKey, stage: options.stage, then: options.then, else: options.else, factory });
  };
}

export function Condition(expr: string, options: StepDecoratorOptions = {}) {
  return function (target: any, propertyKey: string) {
    const meta = getOrCreateWorkflowMeta(target.constructor);
    const stepId = options.id ?? propertyKey;
    const orderKey = options.order ?? meta.steps.length;
    const factory: StepFactory = (id) => makeConditionStep(id, expr);
    meta.steps.push({ stepId, methodKey: propertyKey, orderKey, stage: options.stage, then: options.then, else: options.else, factory });
  };
}

export function Transform(
  mappingOrOperations: Record<string, string> | Record<string, any>[],
  options: StepDecoratorOptions = {}
) {
  return function (target: any, propertyKey: string) {
    const meta = getOrCreateWorkflowMeta(target.constructor);
    const stepId = options.id ?? propertyKey;
    const orderKey = options.order ?? meta.steps.length;
    const factory: StepFactory = (id) => makeTransformStep(id, mappingOrOperations);
    meta.steps.push({ stepId, methodKey: propertyKey, orderKey, stage: options.stage, then: options.then, else: options.else, factory });
  };
}

export function Auth(
  connectorId: AuthConnectorId,
  action: AuthAction,
  config: Record<string, any>,
  options: StepDecoratorOptions = {}
) {
  return function (target: any, propertyKey: string) {
    const meta = getOrCreateWorkflowMeta(target.constructor);
    const stepId = options.id ?? propertyKey;
    const orderKey = options.order ?? meta.steps.length;
    const factory: StepFactory = (id) => makeAuthStep(id, connectorId, action, config);
    meta.steps.push({ stepId, methodKey: propertyKey, orderKey, stage: options.stage, then: options.then, else: options.else, factory });
  };
}

export function Encrypt(
  connectorId: EncryptionConnectorId,
  action: EncryptionAction,
  config: Record<string, any>,
  options: StepDecoratorOptions = {}
) {
  return function (target: any, propertyKey: string) {
    const meta = getOrCreateWorkflowMeta(target.constructor);
    const stepId = options.id ?? propertyKey;
    const orderKey = options.order ?? meta.steps.length;
    const factory: StepFactory = (id) => makeEncryptStep(id, connectorId, action, config);
    meta.steps.push({ stepId, methodKey: propertyKey, orderKey, stage: options.stage, then: options.then, else: options.else, factory });
  };
}

export function Responder(
  type: ResponderType,
  config: {
    statusCode?: number;
    headers?: Record<string, string>;
    body?: any;
    contentType?: string;
    location?: string;
  },
  options: StepDecoratorOptions = {}
) {
  return function (target: any, propertyKey: string) {
    const meta = getOrCreateWorkflowMeta(target.constructor);
    const stepId = options.id ?? propertyKey;
    const orderKey = options.order ?? meta.steps.length;
    const factory: StepFactory = (id) => makeResponderStep(id, type, config);
    meta.steps.push({ stepId, methodKey: propertyKey, orderKey, stage: options.stage, then: options.then, else: options.else, factory });
  };
}

export function Code(
  sourceOrModule: string,
  fn?: string,
  args?: Record<string, any>,
  config?: { input_from?: string; timeout?: number },
  options: StepDecoratorOptions = {}
) {
  return function (target: any, propertyKey: string) {
    const meta = getOrCreateWorkflowMeta(target.constructor);
    const stepId = options.id ?? propertyKey;
    const orderKey = options.order ?? meta.steps.length;
    const factory: StepFactory = (id) => makeCodeStep(id, sourceOrModule, fn, args, config);
    meta.steps.push({ stepId, methodKey: propertyKey, orderKey, stage: options.stage, then: options.then, else: options.else, factory });
  };
}

export function Call(
  functionSlugOrId: string,
  args: Record<string, any>,
  options: StepDecoratorOptions = {}
) {
  return function (target: any, propertyKey: string) {
    const meta = getOrCreateWorkflowMeta(target.constructor);
    const stepId = options.id ?? propertyKey;
    const orderKey = options.order ?? meta.steps.length;
    const factory: StepFactory = (id) => makeCallStep(id, functionSlugOrId, args);
    meta.steps.push({ stepId, methodKey: propertyKey, orderKey, stage: options.stage, then: options.then, else: options.else, factory });
  };
}

export function CallWorkflow(
  workflowId: string,
  payload?: Record<string, any>,
  options: StepDecoratorOptions = {}
) {
  return function (target: any, propertyKey: string) {
    const meta = getOrCreateWorkflowMeta(target.constructor);
    const stepId = options.id ?? propertyKey;
    const orderKey = options.order ?? meta.steps.length;
    const factory: StepFactory = (id) => makeCallWorkflowStep(id, workflowId, payload);
    meta.steps.push({ stepId, methodKey: propertyKey, orderKey, stage: options.stage, then: options.then, else: options.else, factory });
  };
}

export function Loop(
  over: string,
  steps: IWorkflowStep[],
  config?: { as?: string; index_as?: string; max_iterations?: number },
  options: StepDecoratorOptions = {}
) {
  return function (target: any, propertyKey: string) {
    const meta = getOrCreateWorkflowMeta(target.constructor);
    const stepId = options.id ?? propertyKey;
    const orderKey = options.order ?? meta.steps.length;
    const factory: StepFactory = (id) => makeLoopStep(id, over, steps, config);
    meta.steps.push({ stepId, methodKey: propertyKey, orderKey, stage: options.stage, then: options.then, else: options.else, factory });
  };
}

export function Log(message: string, options: StepDecoratorOptions = {}) {
  return function (target: any, propertyKey: string) {
    const meta = getOrCreateWorkflowMeta(target.constructor);
    const stepId = options.id ?? propertyKey;
    const orderKey = options.order ?? meta.steps.length;
    const factory: StepFactory = (id) => makeLogStep(id, message);
    meta.steps.push({ stepId, methodKey: propertyKey, orderKey, stage: options.stage, then: options.then, else: options.else, factory });
  };
}

export function Delay(ms: number, options: StepDecoratorOptions = {}) {
  return function (target: any, propertyKey: string) {
    const meta = getOrCreateWorkflowMeta(target.constructor);
    const stepId = options.id ?? propertyKey;
    const orderKey = options.order ?? meta.steps.length;
    const factory: StepFactory = (id) => makeDelayStep(id, ms);
    meta.steps.push({ stepId, methodKey: propertyKey, orderKey, stage: options.stage, then: options.then, else: options.else, factory });
  };
}

export function Notify(channel: string, message: string, options: StepDecoratorOptions = {}) {
  return function (target: any, propertyKey: string) {
    const meta = getOrCreateWorkflowMeta(target.constructor);
    const stepId = options.id ?? propertyKey;
    const orderKey = options.order ?? meta.steps.length;
    const factory: StepFactory = (id) => makeNotifyStep(id, channel, message);
    meta.steps.push({ stepId, methodKey: propertyKey, orderKey, stage: options.stage, then: options.then, else: options.else, factory });
  };
}

