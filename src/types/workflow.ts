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
  CUSTOM = "custom",
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
  headers?: Record<string, any> | Array<{ key: string; value: any }>;
  timeout?: number;
  files?: any;
  installation_id?: string;
  connection_id?: string;
  database?: string;
  vars?: Record<string, any>;
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

export type ValidationRule =
  | { name: "required" | "not_empty" | "is_empty" | "is_email" | "is_number" | "is_string" | "is_boolean" | "is_array" | "is_object" | "is_url" | "is_date" | "is_uuid" | "is_cuid" | "is_jwt" | "is_json" | "is_alphanumeric" | "is_alpha" | "is_numeric_string" | "is_hex_color" | "is_base64" | "is_credit_card" | "is_lowercase" | "is_uppercase" | "is_slug" | "is_mac_address" | "is_currency" | "is_port" | "is_latitude" | "is_longitude"; config?: { message?: string } }
  | { name: "is_strong_password"; config?: { minLength?: number; minLowercase?: number; minUppercase?: number; minNumbers?: number; minSymbols?: number; message?: string } }
  | { name: "is_ip"; config?: { version?: 4 | 6; message?: string } }
  | { name: "contains" | "not_contains"; config: { search: any; caseSensitive?: boolean; message?: string } }
  | { name: "begins_with"; config: { prefix: any; caseSensitive?: boolean; message?: string } }
  | { name: "ends_with"; config: { suffix: any; caseSensitive?: boolean; message?: string } }
  | { name: "is_in" | "not_in"; config: { values: any[]; caseSensitive?: boolean; message?: string } }
  | { name: "is_phone"; config?: { pattern?: string; message?: string } }
  | { name: "length"; config?: { min?: number; max?: number; exact?: number; message?: string } }
  | { name: "range"; config?: { min?: number; max?: number; message?: string } }
  | { name: "matches"; config: { pattern: string; flags?: string; message?: string } }
  | { name: "equals" | "not_equals"; config: { value: any; message?: string } }
  | { name: "greater_than" | "greater_than_or_equal" | "less_than" | "less_than_or_equal"; config: { value: number; message?: string } }
  | { name: "is_address"; config?: { minLength?: number; maxLength?: number; message?: string } };

export interface IWorkflowStepValidator extends IWorkflowStepBase {
  type: WorkflowStepType.VALIDATOR;
  input_from?: string;
  validationGroups: Array<{
    fields: string[];
    validators: Array<ValidationRule>;
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

export interface IWorkflowStepCustom extends IWorkflowStepBase {
  type: WorkflowStepType.CUSTOM;
  source?: string;
  args?: Record<string, any>;
  input_from?: string;
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
  | IWorkflowStepAuthentication
  | IWorkflowStepCustom;

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
