import { renderTemplate, evaluateExpression } from "../template";

function resolveTemplateOrExpression(
  value: string,
  ctx: Record<string, any>
): Promise<any> {
  if (typeof value !== "string") return Promise.resolve(value);
  const trimmed = value.trim();
  if (trimmed.startsWith("{{") && trimmed.endsWith("}}")) {
    const expr = trimmed.slice(2, -2).trim();
    return evaluateExpression(expr, ctx);
  }
  return renderTemplate(value, ctx) as Promise<any>;
}

async function renderBodyRecursive(val: any, ctx: Record<string, any>): Promise<any> {
  if (val == null) return val;
  if (typeof val === "string" && val.includes("{{")) {
    const rendered = await renderTemplate(val, ctx);
    if (typeof rendered === "string" && rendered.startsWith("{") && rendered.endsWith("}")) {
      try {
        return JSON.parse(rendered);
      } catch {
        return rendered;
      }
    }
    if (typeof rendered === "string" && rendered.startsWith("[") && rendered.endsWith("]")) {
      try {
        return JSON.parse(rendered);
      } catch {
        return rendered;
      }
    }
    return rendered;
  }
  if (Array.isArray(val)) {
    return Promise.all(val.map((v) => renderBodyRecursive(v, ctx)));
  }
  if (typeof val === "object") {
    const out: Record<string, any> = {};
    for (const k of Object.keys(val)) {
      out[k] = await renderBodyRecursive(val[k], ctx);
    }
    return out;
  }
  return val;
}
import { executeConnectorAction } from "./connector.executor";
import { applyValidations } from "../validators/validators";
import {
  jsonResponderConnector,
  httpResponderConnector,
  rawResponderConnector,
  redirectResponderConnector,
  emptyResponderConnector,
  conditionLogicConnector,
  mongodbConnector,
  mysqlConnector,
  postgresConnector,
  redisConnector,
  bearerAuthConnector,
  apiKeyAuthConnector,
  dateTimeUtilityConnector,
  stringUtilityConnector,
  randomUtilityConnector,
  mathUtilityConnector,
  compareUtilityConnector,
  geoUtilityConnector,
  base64EncryptionConnector,
  hashEncryptionConnector,
  aesEncryptionConnector,
  rsaEncryptionConnector,
  hmacEncryptionConnector,
  passwordEncryptionConnector,
} from "../connectors/builtin";
import { IWorkflow, IWorkflowStep, WorkflowStepType } from "../types/workflow";

export interface RunState {
  workflow: IWorkflow;
  trigger: any;
  body: any;
  bracket: any;
  brackets: any;
  callStack: any[];
  stepResults: Record<string, any>;
  stepErrors: Record<string, any>;
  vars: Record<string, any>;
  headers: Record<string, string>;
  params: Record<string, any>;
  pathParams: Record<string, any>;
  query: Record<string, any>;
  tenantId?: string;
  env: Record<string, string>;
  connectorConfig?: Record<string, any>;
}

export interface ProcessorEngineOptions {
  connectors?: Map<string, any>;
  workflows?: Map<string, any>;
  functions?: Map<string, any>;
  connectorConfig?: Record<string, any>;
  client?: any;
}

export class ProcessorEngine {
  private connectors: Map<string, any>;
  private workflows: Map<string, any>;
  private functions: Map<string, any>;
  private connectorConfig: Record<string, any>;
  private client: any;

  constructor(options: ProcessorEngineOptions = {}) {
    this.connectors = options.connectors || new Map();
    this.workflows = options.workflows || new Map();
    this.functions = options.functions || new Map();
    this.connectorConfig = options.connectorConfig || {};
    this.client = options.client || null;
  }

  getConnector(id: string): any {
    const builtin: Record<string, any> = {
      "json.responder": jsonResponderConnector,
      "http.responder": httpResponderConnector,
      "raw.responder": rawResponderConnector,
      "redirect.responder": redirectResponderConnector,
      "empty.responder": emptyResponderConnector,
      "condition.logic": conditionLogicConnector,
      "mongodb.system": mongodbConnector,
      "mysql.system": mysqlConnector,
      "postgres.system": postgresConnector,
      "redis.system": redisConnector,
      "bearer.system": bearerAuthConnector,
      "api_key.system": apiKeyAuthConnector,
      "utility.date_time": dateTimeUtilityConnector,
      "utility.string": stringUtilityConnector,
      "utility.random": randomUtilityConnector,
      "utility.math": mathUtilityConnector,
      "utility.compare": compareUtilityConnector,
      "utility.geo": geoUtilityConnector,
      "base64.encryption": base64EncryptionConnector,
      "hash.encryption": hashEncryptionConnector,
      "aes.encryption": aesEncryptionConnector,
      "rsa.encryption": rsaEncryptionConnector,
      "hmac.encryption": hmacEncryptionConnector,
      "password.encryption": passwordEncryptionConnector,
    };
    return builtin[id] ?? this.connectors.get(id);
  }

  private async getConnectorOrFetch(id: string): Promise<any> {
    let connector = this.getConnector(id);
    if (connector) return connector;
    if (this.client?.connectors?.get) {
      try {
        connector = await this.client.connectors.get(id);
        if (connector) this.connectors.set(id, connector);
      } catch {
        connector = null;
      }
    }
    return connector;
  }

  async runWorkflow(
    workflow: IWorkflow,
    triggerPayload: any = {}
  ): Promise<{ statusCode?: number; headers?: Record<string, string>; body?: any }> {
    const normalizedTrigger = this.normalizeTrigger(triggerPayload);
    const headers = (triggerPayload as any)?.headers || {};
    delete (headers as any).host;
    const pathParams = (triggerPayload as any)?.pathParams ?? (triggerPayload as any)?.path_params ?? {};
    const params = (triggerPayload as any)?.params ?? {};
    const query = (triggerPayload as any)?.query ?? {};
    const inputData = normalizedTrigger?.data ?? {};
    const workflowVars = (workflow as any).vars || {};
    const payloadVars = (triggerPayload as any)?.vars ?? {};
    const payloadEnv = (triggerPayload as any)?.envVars ?? (triggerPayload as any)?.env_vars ?? (triggerPayload as any)?.env ?? {};

    const state: RunState = {
      workflow,
      trigger: normalizedTrigger,
      body: inputData,
      bracket: inputData,
      brackets: inputData,
      callStack: (triggerPayload as any)?.callStack ?? (triggerPayload as any)?.call_stack ?? [],
      stepResults: {},
      stepErrors: {},
      vars: { ...workflowVars, ...payloadVars },
      headers,
      params: { ...query, ...params },
      pathParams,
      query,
      tenantId: (workflow as any).tenant_id,
      env: payloadEnv,
      connectorConfig: this.connectorConfig,
    };

    const steps = workflow.steps || [];
    const maxSteps = 1000;
    let counter = 0;

    const linearNext = new Map<string, string>();
    steps.forEach((step: IWorkflowStep) => {
      if (step.input_from) linearNext.set(step.input_from, step.id);
    });

    const findNextStepIndex = (currentStep: IWorkflowStep): number => {
      const nextStepId = linearNext.get(currentStep.id);
      if (nextStepId) {
        const idx = steps.findIndex((s: IWorkflowStep) => s.id === nextStepId);
        if (idx >= 0) return idx;
      }
      return -1;
    };

    const checkAndJumpToErrorBranch = (step: IWorkflowStep): boolean => {
      const errorBranchId = (step as any).else || (step as any).on_error;
      if (errorBranchId) {
        const idx = steps.findIndex((s: IWorkflowStep) => s.id === errorBranchId);
        if (idx >= 0) {
          currentStepIndex = idx;
          return true;
        }
      }
      return false;
    };

    const checkAndJumpToSuccessBranch = (step: IWorkflowStep): boolean => {
      const successBranchId = (step as any).then;
      if (successBranchId) {
        const idx = steps.findIndex((s: IWorkflowStep) => s.id === successBranchId);
        if (idx >= 0) {
          currentStepIndex = idx;
          return true;
        }
      }
      return false;
    };

    const isResultFailure = (result: any): boolean => {
      if (result === null || result === undefined) return true;
      if (typeof result === "object" && (result.ok === false || result.valid === false)) return true;
      return false;
    };

    let currentStepIndex = steps.findIndex((s: IWorkflowStep) => !s.input_from);
    if (currentStepIndex < 0) currentStepIndex = 0;

    const templateState = () => ({
      ...state.stepResults,
      stepResults: state.stepResults,
      trigger: state.trigger,
      body: state.body,
      vars: state.vars,
      headers: state.headers,
      params: state.params,
      pathParams: state.pathParams,
      query: state.query,
      env: state.env,
    });

    while (currentStepIndex >= 0 && currentStepIndex < steps.length) {
      if (++counter > maxSteps) throw new Error("max steps exceeded");
      const step = steps[currentStepIndex];
      const ctx = templateState();

      try {
        if (step.type === WorkflowStepType.RESPONDER) {
          const respStep = step as any;
          let shouldExecute = true;
          if (respStep.when) {
            try {
              shouldExecute = await evaluateExpression(respStep.when, { ...ctx, error: state.stepErrors });
            } catch {
              shouldExecute = false;
            }
          }
          if (shouldExecute) {
            const responderId = `${respStep.responder}.responder`;
            const connector = responderId === "json.responder" ? jsonResponderConnector : this.getConnector(responderId);
            if (!connector) throw new Error(`Responder not found: ${responderId}`);
            const config = respStep.config || {};
            let statusCode = config.statusCode ?? 200;
            if (typeof statusCode === "string" && statusCode.includes("{{")) {
              statusCode = Number(await renderTemplate(statusCode, state)) || 200;
            }
            const options: any = { statusCode };
            if (config.headers) {
              options.headers = {};
              for (const [k, v] of Object.entries(config.headers)) {
                options.headers[k] = typeof v === "string" && (v as string).includes("{{")
                  ? await renderTemplate(v as string, state)
                  : v;
              }
            }
            if (config.body !== undefined) {
              options.body = await renderBodyRecursive(config.body, state);
            }
            const resp = await executeConnectorAction(connector, "json.respond", options, state);
            if (resp?.terminate) return resp;
          }
          const nextIdx = findNextStepIndex(step);
          currentStepIndex = nextIdx >= 0 ? nextIdx : -1;
          continue;
        }

        if (step.type === WorkflowStepType.VALIDATOR) {
          const valStep = step as any;
          let inputData: Record<string, any> = {};
          if (valStep.input_from) {
            inputData = state.stepResults[valStep.input_from]?.result ?? state.stepResults[valStep.input_from] ?? {};
          } else {
            inputData = state.trigger?.data ?? state.trigger ?? {};
          }
          const templateStateForVal = { ...state.stepResults, trigger: state.trigger, body: state.body, vars: state.vars };
          const resolvedGroups = await Promise.all(
            (valStep.validationGroups || []).map(async (group: any) => {
              const resolvedFields = await Promise.all(
                (group.fields || []).map((expr: string) => renderTemplate(expr, templateStateForVal))
              );
              const fieldNames = (group.fields || []).map((expr: string) => {
                const parts = expr.replace(/\{\{|\}\}/g, "").trim().split(".");
                return parts.length > 0 ? parts[parts.length - 1] : expr;
              });
              const resolvedValidators = await Promise.all(
                (group.validators || []).map(async (v: any) => {
                  const cfg: Record<string, any> = {};
                  for (const [k, val] of Object.entries(v.config || {})) {
                    if (typeof val === "string" && (String(val).includes("{{") || String(val).includes("${"))) {
                      cfg[k] = await renderTemplate(String(val), templateStateForVal);
                    } else {
                      cfg[k] = val;
                    }
                  }
                  return { name: v.name, config: cfg };
                })
              );
              return { fields: resolvedFields, fieldNames, validators: resolvedValidators };
            })
          );
          const errors: Record<string, string> = {};
          let allValid = true;
          for (const group of resolvedGroups) {
            const { fields = [], fieldNames = [], validators = [] } = group;
            if (fields.length === 0 || validators.length === 0) continue;
            for (let i = 0; i < fields.length; i++) {
              const val = fields[i];
              const name = (fieldNames && fieldNames[i]) || `field_${i}`;
              const validations = validators.map((v: any) => ({ validator: v.name, options: v.config || {} }));
              const validation = applyValidations(validations, val);
              if (!validation.valid) {
                allValid = false;
                errors[name] = validation.error || validation.message || "Validation failed";
              }
            }
          }
          const result = {
            valid: allValid,
            ok: allValid,
            statusCode: allValid ? 200 : 400,
            errors: Object.keys(errors).length > 0 ? errors : undefined,
            result: allValid ? { valid: true } : { valid: false, error: "Validation failed", message: "One or more validation errors occurred" },
          };
          state.stepResults[step.id] = result;
          if (!allValid) {
            if (checkAndJumpToErrorBranch(step)) continue;
            const nextIdx = findNextStepIndex(step);
            currentStepIndex = nextIdx >= 0 ? nextIdx : -1;
            continue;
          }
          if (checkAndJumpToSuccessBranch(step)) continue;
          const nextIdx = findNextStepIndex(step);
          currentStepIndex = nextIdx >= 0 ? nextIdx : -1;
          continue;
        }

        if (step.type === WorkflowStepType.CONDITION) {
          const condStep = step as any;
          let passBool = false;
          const mode = condStep.mode || "jexl";
          if (mode === "jexl" && condStep.if) {
            let rendered = await renderTemplate(condStep.if, ctx);
            if (typeof rendered === "string") rendered = rendered.trim();
            if (!rendered) rendered = "false";
            try {
              passBool = Boolean(await evaluateExpression(String(rendered), ctx));
            } catch {
              passBool = false;
            }
          }
          state.stepResults[step.id] = passBool;
          let nextIdx = -1;
          if (passBool) {
            nextIdx = condStep.then ? steps.findIndex((s: IWorkflowStep) => s.id === condStep.then) : findNextStepIndex(step);
          } else {
            nextIdx = condStep.else ? steps.findIndex((s: IWorkflowStep) => s.id === condStep.else) : findNextStepIndex(step);
          }
          currentStepIndex = nextIdx >= 0 ? nextIdx : -1;
          continue;
        }

        if (step.type === WorkflowStepType.TRANSFORM) {
          const transStep = step as any;
          if (transStep.mapping) {
            const out: Record<string, any> = {};
            for (const k of Object.keys(transStep.mapping)) {
              out[k] = await resolveTemplateOrExpression(transStep.mapping[k], ctx);
            }
            state.stepResults[step.id] = out;
          } else if (transStep.operations) {
            let base: Record<string, any> = {};
            if (transStep.input_from) base = state.stepResults[transStep.input_from] ?? {};
            else base = state.trigger?.data ?? {};
            const out = JSON.parse(JSON.stringify(base));
            for (const op of transStep.operations) {
              if (op.action === "map" && op.mapping) {
                for (const key of Object.keys(op.mapping)) {
                  out[key] = await resolveTemplateOrExpression(op.mapping[key], ctx);
                }
              }
            }
            state.stepResults[step.id] = out;
          } else {
            state.stepResults[step.id] = {};
          }
          const nextIdx = findNextStepIndex(step);
          currentStepIndex = nextIdx >= 0 ? nextIdx : -1;
          continue;
        }

        if (step.type === WorkflowStepType.LOG) {
          const logStep = step as any;
          const msg = await renderTemplate(logStep.message, ctx);
          state.stepResults[step.id] = { logged: msg };
          const nextIdx = findNextStepIndex(step);
          currentStepIndex = nextIdx >= 0 ? nextIdx : -1;
          continue;
        }

        if (step.type === WorkflowStepType.DELAY) {
          const delayStep = step as any;
          await new Promise((r) => setTimeout(r, delayStep.ms || 0));
          state.stepResults[step.id] = { delayed: delayStep.ms };
          const nextIdx = findNextStepIndex(step);
          currentStepIndex = nextIdx >= 0 ? nextIdx : -1;
          continue;
        }

        if (step.type === WorkflowStepType.CODE) {
          const codeStep = step as any;
          const input =
            codeStep.input_from
              ? state.stepResults[codeStep.input_from]?.result ??
                state.stepResults[codeStep.input_from]?.output ??
                state.stepResults[codeStep.input_from] ??
                {}
              : state.trigger?.data ?? state.trigger ?? {};

          const ctxForCode = {
            input,
            trigger: state.trigger,
            steps: state.stepResults,
            vars: state.vars,
          };

          let result: any = null;
          if (codeStep.source) {
            const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor as any;
            const userFn = new AsyncFunction("ctx", "platform", codeStep.source);
            result = await userFn(ctxForCode, {});
          } else if (codeStep.module_ref) {
            throw new Error("module_ref is not supported in local code steps");
          } else {
            throw new Error("code step must have either source or module_ref");
          }

          if (result && typeof result === "object" && result.setVars && typeof result.setVars === "object") {
            for (const k of Object.keys(result.setVars)) {
              state.vars[k] = result.setVars[k];
            }
          }

          state.stepResults[step.id] = { result: result?.out ?? result };
          const nextIdx = findNextStepIndex(step);
          currentStepIndex = nextIdx >= 0 ? nextIdx : -1;
          continue;
        }

        if (step.type === WorkflowStepType.API_CALL) {
          const apiStep = step as any;
          const connector = await this.getConnectorOrFetch(apiStep.connector_id);
          if (!connector) throw new Error("connector not found: " + apiStep.connector_id);
          let body = apiStep.body || {};
          if (typeof body === "object") body = JSON.parse(await renderTemplate(JSON.stringify(body), state));
          else if (typeof body === "string") body = await renderTemplate(body, state);
          const pathParams: Record<string, any> = {};
          for (const k of Object.keys(apiStep.pathParams || {})) {
            pathParams[k] = typeof (apiStep.pathParams as any)[k] === "string" && (apiStep.pathParams as any)[k].includes("{{")
              ? await renderTemplate((apiStep.pathParams as any)[k], state)
              : (apiStep.pathParams as any)[k];
          }
          const params: Record<string, any> = {};
          for (const k of Object.keys(apiStep.params || {})) {
            params[k] = typeof (apiStep.params as any)[k] === "string" && (apiStep.params as any)[k].includes("{{")
              ? await renderTemplate((apiStep.params as any)[k], state)
              : (apiStep.params as any)[k];
          }
          const resp = await executeConnectorAction(connector, apiStep.action, { params, pathParams, body }, state);
          if (resp?.terminate) return resp;
          const normalResp = resp as { mapped?: any; raw?: any };
          state.stepResults[step.id] = normalResp?.mapped ?? normalResp?.raw ?? null;

          if (typeof (step as any).post_source === "string" && (step as any).post_source.trim().length > 0) {
            const postFnSource = (step as any).post_source as string;
            const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor as any;
            const userFn = new AsyncFunction("ctx", "platform", postFnSource);
            const postCtx = {
              input: state.stepResults[step.id],
              trigger: state.trigger,
              steps: state.stepResults,
              vars: state.vars,
            };
            const postRes = await userFn(postCtx, {});
            if (postRes && typeof postRes === "object" && postRes.setVars && typeof postRes.setVars === "object") {
              for (const k of Object.keys(postRes.setVars)) state.vars[k] = postRes.setVars[k];
            }
            if (postRes && typeof postRes === "object" && Object.prototype.hasOwnProperty.call(postRes, "out")) {
              state.stepResults[step.id] = postRes.out;
            } else if (postRes !== undefined && typeof postRes !== "object") {
              state.stepResults[step.id] = postRes;
            }
          }

          if (isResultFailure(state.stepResults[step.id])) {
            if (checkAndJumpToErrorBranch(step)) continue;
            const nextIdx = findNextStepIndex(step);
            currentStepIndex = nextIdx >= 0 ? nextIdx : -1;
            continue;
          }
          if (checkAndJumpToSuccessBranch(step)) continue;
          const nextIdx = findNextStepIndex(step);
          currentStepIndex = nextIdx >= 0 ? nextIdx : -1;
          continue;
        }

        if (step.type === WorkflowStepType.AUTHENTICATION) {
          const authStep = step as any;
          const connector = await this.getConnectorOrFetch(authStep.connector_id);
          if (!connector) throw new Error("connector not found: " + authStep.connector_id);
          let body = authStep.body || {};
          if (typeof body === "object") body = JSON.parse(await renderTemplate(JSON.stringify(body), state));
          else if (typeof body === "string") body = await renderTemplate(body, state);
          const resp = await executeConnectorAction(connector, authStep.action, { body, ...body }, state);
          if (resp?.terminate) return resp;
          const authResult = resp as any;
          state.stepResults[step.id] = authResult?.mapped ?? authResult ?? resp;

          if (typeof (step as any).post_source === "string" && (step as any).post_source.trim().length > 0) {
            const postFnSource = (step as any).post_source as string;
            const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor as any;
            const userFn = new AsyncFunction("ctx", "platform", postFnSource);
            const postCtx = {
              input: state.stepResults[step.id],
              trigger: state.trigger,
              steps: state.stepResults,
              vars: state.vars,
            };
            const postRes = await userFn(postCtx, {});
            if (postRes && typeof postRes === "object" && postRes.setVars && typeof postRes.setVars === "object") {
              for (const k of Object.keys(postRes.setVars)) state.vars[k] = postRes.setVars[k];
            }
            if (postRes && typeof postRes === "object" && Object.prototype.hasOwnProperty.call(postRes, "out")) {
              state.stepResults[step.id] = postRes.out;
            } else if (postRes !== undefined && typeof postRes !== "object") {
              state.stepResults[step.id] = postRes;
            }
          }

          if (isResultFailure(state.stepResults[step.id])) {
            if (checkAndJumpToErrorBranch(step)) continue;
            const nextIdx = findNextStepIndex(step);
            currentStepIndex = nextIdx >= 0 ? nextIdx : -1;
            continue;
          }
          if (checkAndJumpToSuccessBranch(step)) continue;
          const nextIdx = findNextStepIndex(step);
          currentStepIndex = nextIdx >= 0 ? nextIdx : -1;
          continue;
        }

        if (step.type === WorkflowStepType.ENCRYPTION) {
          const encStep = step as any;
          const connector = await this.getConnectorOrFetch(encStep.connector_id);
          if (!connector) throw new Error("connector not found: " + encStep.connector_id);
          let body = encStep.body || encStep.params || {};
          if (typeof body === "object") body = JSON.parse(await renderTemplate(JSON.stringify(body), state));
          else if (typeof body === "string") body = await renderTemplate(body, state);
          const resp = await executeConnectorAction(connector, encStep.action, { body, ...body }, state);
          if (resp?.terminate) return resp;
          const normalResp = resp as { mapped?: any; raw?: any };
          state.stepResults[step.id] = normalResp?.mapped ?? normalResp?.raw ?? null;

          if (typeof (step as any).post_source === "string" && (step as any).post_source.trim().length > 0) {
            const postFnSource = (step as any).post_source as string;
            const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor as any;
            const userFn = new AsyncFunction("ctx", "platform", postFnSource);
            const postCtx = {
              input: state.stepResults[step.id],
              trigger: state.trigger,
              steps: state.stepResults,
              vars: state.vars,
            };
            const postRes = await userFn(postCtx, {});
            if (postRes && typeof postRes === "object" && postRes.setVars && typeof postRes.setVars === "object") {
              for (const k of Object.keys(postRes.setVars)) state.vars[k] = postRes.setVars[k];
            }
            if (postRes && typeof postRes === "object" && Object.prototype.hasOwnProperty.call(postRes, "out")) {
              state.stepResults[step.id] = postRes.out;
            } else if (postRes !== undefined && typeof postRes !== "object") {
              state.stepResults[step.id] = postRes;
            }
          }

          if (checkAndJumpToSuccessBranch(step)) continue;
          const nextIdx = findNextStepIndex(step);
          currentStepIndex = nextIdx >= 0 ? nextIdx : -1;
          continue;
        }

        if (step.type === WorkflowStepType.DB) {
          const dbStep = step as any;
          const connector = await this.getConnectorOrFetch(dbStep.connector_id);
          if (!connector) throw new Error("connector not found: " + dbStep.connector_id);
          let body = dbStep.body || {};
          if (typeof body === "object") body = JSON.parse(await renderTemplate(JSON.stringify(body), state));
          else if (typeof body === "string") body = await renderTemplate(body, state);
          const options = { ...body };
          if (dbStep.connection_id) options.connection_id = dbStep.connection_id;
          if (dbStep.database) options.database = dbStep.database;
          const resp = await executeConnectorAction(connector, dbStep.action, options, state);
          if (resp?.terminate) return resp;
          const normalResp = resp as { mapped?: any; raw?: any };
          state.stepResults[step.id] = normalResp?.mapped ?? normalResp?.raw ?? null;

          if (typeof (step as any).post_source === "string" && (step as any).post_source.trim().length > 0) {
            const postFnSource = (step as any).post_source as string;
            const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor as any;
            const userFn = new AsyncFunction("ctx", "platform", postFnSource);
            const postCtx = {
              input: state.stepResults[step.id],
              trigger: state.trigger,
              steps: state.stepResults,
              vars: state.vars,
            };
            const postRes = await userFn(postCtx, {});
            if (postRes && typeof postRes === "object" && postRes.setVars && typeof postRes.setVars === "object") {
              for (const k of Object.keys(postRes.setVars)) state.vars[k] = postRes.setVars[k];
            }
            if (postRes && typeof postRes === "object" && Object.prototype.hasOwnProperty.call(postRes, "out")) {
              state.stepResults[step.id] = postRes.out;
            } else if (postRes !== undefined && typeof postRes !== "object") {
              state.stepResults[step.id] = postRes;
            }
          }

          if (checkAndJumpToSuccessBranch(step)) continue;
          const nextIdx = findNextStepIndex(step);
          currentStepIndex = nextIdx >= 0 ? nextIdx : -1;
          continue;
        }

        if (step.type === WorkflowStepType.FUNCTION) {
          const fnStep = step as any;
          const fnId = fnStep.function_id || fnStep.function_slug;
          if (!fnId) throw new Error("function step missing function_id or function_slug");
          const args: Record<string, any> = {};
          for (const k of Object.keys(fnStep.args || {})) {
            const v = fnStep.args[k];
            args[k] = typeof v === "string" && v.includes("{{") ? await renderTemplate(v, state) : v;
          }
          const fn = this.functions.get(fnId);
          let fnResult: { ok: boolean; data?: any; error?: string; stepResults?: any };
          if (fn) {
            fnResult = await this.runFunction(fn, args, state);
          } else if (this.client?.functions?.invoke) {
            try {
              const data = await this.client.functions.invoke(fnId, args);
              fnResult = { ok: true, data };
            } catch (e: any) {
              fnResult = { ok: false, error: e?.message || "Remote function failed" };
            }
          } else {
            throw new Error("Function not found: " + fnId);
          }
          state.stepResults[step.id] = fnResult.ok ? (fnResult.data ?? fnResult.stepResults ?? {}) : { error: fnResult.error, ok: false };

          if (typeof (step as any).post_source === "string" && (step as any).post_source.trim().length > 0) {
            const postFnSource = (step as any).post_source as string;
            const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor as any;
            const userFn = new AsyncFunction("ctx", "platform", postFnSource);
            const postCtx = {
              input: state.stepResults[step.id],
              trigger: state.trigger,
              steps: state.stepResults,
              vars: state.vars,
            };
            const postRes = await userFn(postCtx, {});
            if (postRes && typeof postRes === "object" && postRes.setVars && typeof postRes.setVars === "object") {
              for (const k of Object.keys(postRes.setVars)) state.vars[k] = postRes.setVars[k];
            }
            if (postRes && typeof postRes === "object" && Object.prototype.hasOwnProperty.call(postRes, "out")) {
              state.stepResults[step.id] = postRes.out;
            } else if (postRes !== undefined && typeof postRes !== "object") {
              state.stepResults[step.id] = postRes;
            }
          }

          if (isResultFailure(state.stepResults[step.id])) {
            if (checkAndJumpToErrorBranch(step)) continue;
            const nextIdx = findNextStepIndex(step);
            currentStepIndex = nextIdx >= 0 ? nextIdx : -1;
            continue;
          }

          if (checkAndJumpToSuccessBranch(step)) continue;
          const nextIdx = findNextStepIndex(step);
          currentStepIndex = nextIdx >= 0 ? nextIdx : -1;
          continue;
        }

        if (step.type === WorkflowStepType.CALL_WORKFLOW) {
          const wfStep = step as any;
          const workflowId = wfStep.workflow_id;
          if (!workflowId) throw new Error("call_workflow step missing workflow_id");
          if (!this.client?.workflows?.run) throw new Error("Client required for callWorkflow. Configure apiKey and apiSecret.");
          let payload = wfStep.payload || {};
          if (typeof payload === "object") {
            payload = JSON.parse(await renderTemplate(JSON.stringify(payload), state));
          }
          const result = await this.client.workflows.run(workflowId, "trigger", { payload });
          const body = result?.body ?? result?.data ?? result;
          state.stepResults[step.id] = body;

          if (typeof (step as any).post_source === "string" && (step as any).post_source.trim().length > 0) {
            const postFnSource = (step as any).post_source as string;
            const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor as any;
            const userFn = new AsyncFunction("ctx", "platform", postFnSource);
            const postCtx = {
              input: state.stepResults[step.id],
              trigger: state.trigger,
              steps: state.stepResults,
              vars: state.vars,
            };
            const postRes = await userFn(postCtx, {});
            if (postRes && typeof postRes === "object" && postRes.setVars && typeof postRes.setVars === "object") {
              for (const k of Object.keys(postRes.setVars)) state.vars[k] = postRes.setVars[k];
            }
            if (postRes && typeof postRes === "object" && Object.prototype.hasOwnProperty.call(postRes, "out")) {
              state.stepResults[step.id] = postRes.out;
            } else if (postRes !== undefined && typeof postRes !== "object") {
              state.stepResults[step.id] = postRes;
            }
          }

          if (isResultFailure(state.stepResults[step.id])) {
            if (checkAndJumpToErrorBranch(step)) continue;
            const nextIdx = findNextStepIndex(step);
            currentStepIndex = nextIdx >= 0 ? nextIdx : -1;
            continue;
          }

          if (checkAndJumpToSuccessBranch(step)) continue;
          const nextIdx = findNextStepIndex(step);
          currentStepIndex = nextIdx >= 0 ? nextIdx : -1;
          continue;
        }

        if (step.type === WorkflowStepType.LOOP) {
          const loopStep = step as any;
          const overExpr = loopStep.over;
          if (!overExpr) throw new Error("Loop step requires 'over' expression");
          const iterableRaw = await evaluateExpression(overExpr, ctx);
          let iterable: any[] = [];
          if (Array.isArray(iterableRaw)) iterable = iterableRaw;
          else if (iterableRaw && typeof iterableRaw === "object" && typeof (iterableRaw as any)[Symbol.iterator] === "function") {
            iterable = Array.from(iterableRaw as Iterable<any>);
          } else if (iterableRaw && typeof iterableRaw === "object") {
            iterable = Object.entries(iterableRaw);
          } else {
            throw new Error("Loop 'over' must evaluate to array or iterable");
          }
          const maxIter = loopStep.max_iterations ?? 1000;
          if (iterable.length > maxIter) throw new Error(`Loop exceeds max iterations (${maxIter})`);
          const as = loopStep.as ?? "item";
          const indexAs = loopStep.index_as ?? "index";
          const nestedSteps = loopStep.steps || [];
          const loopResults: any[] = [];
          for (let idx = 0; idx < iterable.length; idx++) {
            const item = iterable[idx];
            const loopCtx = {
              ...ctx,
              vars: { ...state.vars, [as]: item, [indexAs]: idx },
              [as]: item,
              [indexAs]: idx,
            };
            let iterResult: any = null;
            for (const ns of nestedSteps) {
              if (ns.type === WorkflowStepType.TRANSFORM && (ns as any).mapping) {
                const out: Record<string, any> = {};
                for (const k of Object.keys((ns as any).mapping)) {
                  out[k] = await resolveTemplateOrExpression((ns as any).mapping[k], loopCtx);
                }
                state.stepResults[ns.id] = out;
                iterResult = out;
              } else if (ns.type === WorkflowStepType.LOG) {
                const msg = await renderTemplate((ns as any).message, loopCtx);
                state.stepResults[ns.id] = { logged: msg };
              }
            }
            loopResults.push({ index: idx, item, result: iterResult });
          }
          state.stepResults[step.id] = { iterations: loopResults.length, results: loopResults };
          const nextIdx = findNextStepIndex(step);
          currentStepIndex = nextIdx >= 0 ? nextIdx : -1;
          continue;
        }

        if (step.type === WorkflowStepType.NOTIFY) {
          state.stepResults[step.id] = { notified: (step as any).channel };
          const nextIdx = findNextStepIndex(step);
          currentStepIndex = nextIdx >= 0 ? nextIdx : -1;
          continue;
        }

        const nextIdx = findNextStepIndex(step);
        currentStepIndex = nextIdx >= 0 ? nextIdx : -1;
      } catch (err: any) {
        state.stepResults[step.id] = { error: err.message, ok: false };
        state.stepErrors[step.id] = { error: err.message };
        if (checkAndJumpToErrorBranch(step)) continue;
        const nextIdx = findNextStepIndex(step);
        if (nextIdx >= 0) {
          currentStepIndex = nextIdx;
          continue;
        }
        throw err;
      }
    }

    return { statusCode: 200, body: state.stepResults };
  }

  async runFunction(func: any, args: Record<string, any>, parentState?: RunState): Promise<{ ok: boolean; data?: any; error?: string; stepResults?: Record<string, any> }> {
    const steps = func.steps || [];
    const state: RunState = {
      workflow: parentState?.workflow || ({} as IWorkflow),
      trigger: parentState?.trigger || {},
      body: parentState?.body ?? args,
      bracket: args,
      brackets: args,
      callStack: parentState?.callStack || [],
      stepResults: {},
      stepErrors: {},
      vars: { ...(parentState?.vars || {}), ...(func.vars || {}) },
      headers: parentState?.headers || {},
      params: parentState?.params || {},
      pathParams: parentState?.pathParams || {},
      query: parentState?.query || {},
      tenantId: parentState?.tenantId,
      env: parentState?.env || {},
      connectorConfig: parentState?.connectorConfig || this.connectorConfig,
    };

    const templateState = () => ({
      ...state.stepResults,
      stepResults: state.stepResults,
      args,
      trigger: state.trigger,
      body: state.body,
      vars: state.vars,
      headers: state.headers,
      params: state.params,
      pathParams: state.pathParams,
      query: state.query,
      env: state.env,
    });

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const ctx = templateState();
      if (step.type === "responder" || (step as any).type === WorkflowStepType.RESPONDER) {
        const connector = jsonResponderConnector;
        const config = (step as any).config || {};
        const options = {
          statusCode: config.statusCode ?? 200,
          body: config.body,
        };
        options.body = await renderBodyRecursive(options.body, ctx);
        const resp = await executeConnectorAction(connector, "json.respond", options, state);
        if (resp?.terminate) return { ok: true, data: resp.body, stepResults: state.stepResults };
      }
      if (step.type === "validator" || (step as any).type === WorkflowStepType.VALIDATOR) {
        const valStep = step as any;
        const inputData = args;
        const templateStateForVal = { ...state.stepResults, args, body: state.body, vars: state.vars };
        const resolvedGroups = await Promise.all(
          (valStep.validationGroups || []).map(async (group: any) => {
            const resolvedFields = await Promise.all(
              (group.fields || []).map((expr: string) => renderTemplate(expr, templateStateForVal))
            );
            const fieldNames = (group.fields || []).map((expr: string) => {
              const parts = expr.replace(/\{\{|\}\}/g, "").trim().split(".");
              return parts.length > 0 ? parts[parts.length - 1] : expr;
            });
            const resolvedValidators = (group.validators || []).map((v: any) => ({
              name: v.name,
              config: v.config || {},
            }));
            return { fields: resolvedFields, fieldNames, validators: resolvedValidators };
          })
        );
        const errors: Record<string, string> = {};
        let allValid = true;
        for (const group of resolvedGroups) {
          const { fields = [], fieldNames = [], validators = [] } = group;
          if (fields.length === 0 || validators.length === 0) continue;
          for (let i = 0; i < fields.length; i++) {
            const val = fields[i];
            const name = (fieldNames && fieldNames[i]) || `field_${i}`;
            const validations = validators.map((v: any) => ({ validator: v.name, options: v.config || {} }));
            const validation = applyValidations(validations, val);
            if (!validation.valid) {
              allValid = false;
              errors[name] = validation.error || validation.message || "Validation failed";
            }
          }
        }
        state.stepResults[step.id] = {
          valid: allValid,
          ok: allValid,
          errors: Object.keys(errors).length > 0 ? errors : undefined,
          result: allValid ? { valid: true } : { valid: false },
        };
      }
      if (step.type === "transform" || (step as any).type === WorkflowStepType.TRANSFORM) {
        const transStep = step as any;
        if (transStep.mapping) {
          const out: Record<string, any> = {};
          for (const k of Object.keys(transStep.mapping)) {
            out[k] = await resolveTemplateOrExpression(transStep.mapping[k], ctx);
          }
          state.stepResults[step.id] = out;
        }
      }
      if (step.type === "api_call" || (step as any).type === WorkflowStepType.API_CALL) {
        const apiStep = step as any;
        const connector = await this.getConnectorOrFetch(apiStep.connector_id);
        if (!connector) throw new Error("connector not found: " + apiStep.connector_id);
        let body = apiStep.body || {};
        if (typeof body === "object") body = JSON.parse(await renderTemplate(JSON.stringify(body), ctx));
        const resp = await executeConnectorAction(connector, apiStep.action, { params: apiStep.params, body }, state);
        if (resp?.terminate) return { ok: true, data: resp.body, stepResults: state.stepResults };
        state.stepResults[step.id] = (resp as any)?.mapped ?? (resp as any)?.raw ?? null;
      }
      if (step.type === "db" || (step as any).type === WorkflowStepType.DB) {
        const dbStep = step as any;
        const connector = await this.getConnectorOrFetch(dbStep.connector_id);
        if (!connector) throw new Error("connector not found: " + dbStep.connector_id);
        let body = dbStep.body || {};
        if (typeof body === "object") body = JSON.parse(await renderTemplate(JSON.stringify(body), ctx));
        const resp = await executeConnectorAction(connector, dbStep.action, { ...body }, state);
        if (resp?.terminate) return { ok: true, data: resp.body, stepResults: state.stepResults };
        state.stepResults[step.id] = (resp as any)?.mapped ?? (resp as any)?.raw ?? null;
      }
    }

    const outputFrom = func.output_from;
    const output = outputFrom
      ? state.stepResults[outputFrom]
      : (() => {
          const lastStep = steps[steps.length - 1];
          return lastStep ? state.stepResults[lastStep.id] : state.stepResults;
        })();
    return { ok: true, data: output, stepResults: state.stepResults };
  }

  private normalizeTrigger(payload: any): any {
    if (!payload || typeof payload !== "object") return payload;
    if (Array.isArray(payload)) return { data: payload, body: payload };
    const trigger = payload.trigger ?? payload;
    const data = trigger.data ?? trigger.body ?? payload.data ?? payload.body ?? payload;
    const bodyObj = typeof data === "object" && data !== null ? data : {};
    return { ...bodyObj, ...trigger, data, body: data };
  }
}
