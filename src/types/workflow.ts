export enum WorkflowTriggerType {
  HTTP = "http",
  WEBHOOK = "webhook",
  JOB = "job",
  SCHEDULE = "schedule",
  EVENT = "event",
  MANUAL = "manual",
}

export enum WorkflowStepType {
  FETCH = "fetch",
  TRANSFORM = "transform",
  VALIDATOR = "validator",
  CONDITION = "condition",
  LOOP = "loop",
  API_CALL = "api_call",
  AUTHENTICATION = "authentication",
  EXTERNAL_API = "external_api",
  DB = "db",
  ENCRYPTION = "encryption",
  NOTIFY = "notify",
  DELAY = "delay",
  LOG = "log",
  RESPONDER = "responder",
  CODE = "code",
  FUNCTION = "function",
  CALL_WORKFLOW = "call_workflow",
}

export interface IWorkflowTrigger {
  type: WorkflowTriggerType;
  source_connector_id?: string;
  event?: string;
  webhook_url?: string;
  cron?: string;
  timezone?: string;
  interval?: string;
  schedule?: string;
}

export interface IWorkflowStepBase {
  id: string;
  type: WorkflowStepType;
  description?: string;
  input_from?: string;
  then?: string;
  else?: string;
}

export interface IWorkflowStepApiCall extends IWorkflowStepBase {
  type: WorkflowStepType.API_CALL;
  connector_id: string;
  action: string;
  params?: Record<string, any>;
  pathParams?: Record<string, any>;
  body?: Record<string, any> | string | null;
}

export interface IWorkflowStepDb extends IWorkflowStepBase {
  type: WorkflowStepType.DB;
  connector_id: string;
  action: string;
  params?: Record<string, any>;
  body?: Record<string, any> | null;
  connection_id?: string;
  database?: string;
}

export interface IWorkflowStepValidator extends IWorkflowStepBase {
  type: WorkflowStepType.VALIDATOR;
  input_from?: string;
  validationGroups: Array<{
    fields: string[];
    validators: Array<{
      name: string;
      config: Record<string, any>;
    }>;
  }>;
}

export interface IWorkflowStepCondition extends IWorkflowStepBase {
  type: WorkflowStepType.CONDITION;
  mode?: "jexl" | "code";
  if?: string;
  then?: string;
  else?: string;
}

export interface IWorkflowStepLoop extends IWorkflowStepBase {
  type: WorkflowStepType.LOOP;
  over: string;
  as?: string;
  index_as?: string;
  steps: IWorkflowStep[];
  max_iterations?: number;
}

export interface IWorkflowStepCode extends IWorkflowStepBase {
  type: WorkflowStepType.CODE;
  source?: string;
  module_ref?: string;
  fn?: string;
  args?: Record<string, any>;
  input_from?: string;
  timeout?: number;
}

export interface IWorkflowStepFunction extends IWorkflowStepBase {
  type: WorkflowStepType.FUNCTION;
  function_id: string;
  function_slug?: string;
  args?: Record<string, any>;
  input_from?: string;
}
export interface IWorkflowStepCallWorkflow extends IWorkflowStepBase {
  type: WorkflowStepType.CALL_WORKFLOW;
  workflow_id: string;
  payload?: Record<string, any>;
  input_from?: string;
}

export interface IWorkflowStepTransform extends IWorkflowStepBase {
  type: WorkflowStepType.TRANSFORM;
  input_from?: string;
  mapping?: Record<string, string>;
  operations?: Record<string, any>[];
}

export interface IWorkflowStepResponder extends IWorkflowStepBase {
  type: WorkflowStepType.RESPONDER;
  responder: "http" | "json" | "raw" | "redirect" | "empty";
  when?: string;
  config: {
    statusCode: number;
    headers?: Record<string, string>;
    body?: any;
    contentType?: string;
    location?: string;
  };
}

export interface IWorkflowStepLog extends IWorkflowStepBase {
  type: WorkflowStepType.LOG;
  message: string;
}

export interface IWorkflowStepDelay extends IWorkflowStepBase {
  type: WorkflowStepType.DELAY;
  ms: number;
}

export interface IWorkflowStepNotify extends IWorkflowStepBase {
  type: WorkflowStepType.NOTIFY;
  channel?: string;
  message: string;
}

export interface IWorkflowStepEncryption extends IWorkflowStepBase {
  type: WorkflowStepType.ENCRYPTION;
  connector_id: string;
  action: string;
  params?: Record<string, any>;
  body?: Record<string, any> | null;
}

export interface IWorkflowStepExternalApi extends IWorkflowStepBase {
  type: WorkflowStepType.EXTERNAL_API;
  connector_id?: string;
  action?: string;
  params?: Record<string, any>;
  body?: Record<string, any> | string | null;
  api_properties?: {
    method: string;
    url: string;
    headers: Record<string, string>;
    queryParams: Record<string, any>;
    bodyType: string;
    body: any;
    authType: string;
    authValue: string;
    timeout: number;
  };
  method?: string;
  url?: string;
  headers?: Record<string, string>;
  authType?: string;
  authValue?: string;
  timeout?: number;
}

export interface IWorkflowStepAuthentication extends IWorkflowStepBase {
  type: WorkflowStepType.AUTHENTICATION;
  connector_id: string;
  action: string;
  params?: Record<string, any>;
  body?: Record<string, any> | null;
}

export type IWorkflowStep =
  | IWorkflowStepApiCall
  | IWorkflowStepDb
  | IWorkflowStepValidator
  | IWorkflowStepCondition
  | IWorkflowStepLoop
  | IWorkflowStepCode
  | IWorkflowStepFunction
  | IWorkflowStepCallWorkflow
  | IWorkflowStepTransform
  | IWorkflowStepResponder
  | IWorkflowStepLog
  | IWorkflowStepDelay
  | IWorkflowStepNotify
  | IWorkflowStepEncryption
  | IWorkflowStepExternalApi
  | IWorkflowStepAuthentication;

export interface IWorkflow {
  _id: string;
  tenant_id?: string;
  project_id?: string;
  name: string;
  description?: string;
  status?: string;
  trigger: IWorkflowTrigger;
  steps: IWorkflowStep[];
  vars?: Record<string, any>;
  settings?: { enable_transactions?: boolean };
}
