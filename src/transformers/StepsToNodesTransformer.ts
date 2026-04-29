import { IWorkflow, IWorkflowStep, IWorkflowTrigger, WorkflowStepType, WorkflowTriggerType } from "../types/workflow";

export interface IWorkflowNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: Record<string, any>;
  label: string;
}

export interface IWorkflowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
}

export interface IWorkflowDataItem {
  name: string;
  type: string;
  nodes: IWorkflowNode[];
  edges: IWorkflowEdge[];
  triggers?: Array<{ id: string; type: string; name: string; enabled?: boolean; config?: any }>;
}

export interface IWorkflowGroup {
  type: string;
  name: string;
  status?: string;
  project_id?: string;
  vars?: Record<string, any>;
  data: IWorkflowDataItem[];
}

function stepTypeToNodeType(step: IWorkflowStep): string {
  const t = step.type;
  if (t === WorkflowStepType.API_CALL) return "connector_api";
  if (t === WorkflowStepType.DB) return "connector_db";
  if (t === WorkflowStepType.TRANSFORM) return "transform";
  if (t === WorkflowStepType.CONDITION) return "condition";
  if (t === WorkflowStepType.VALIDATOR) return "connector_api";
  if (t === WorkflowStepType.RESPONDER) return "connector_api";
  if (t === WorkflowStepType.AUTHENTICATION) return "authentication";
  if (t === WorkflowStepType.FUNCTION) return "function";
  if (t === WorkflowStepType.ENCRYPTION) return "connector_api";
  if (t === WorkflowStepType.LOG) return "log";
  if (t === WorkflowStepType.DELAY) return "delay";
  if (t === WorkflowStepType.NOTIFY) return "notify";
  return "connector_api";
}

function stepToNodeData(step: IWorkflowStep, index: number): Record<string, any> {
  const data: Record<string, any> = { label: step.id };
  const s = step as any;
  if (step.type === WorkflowStepType.API_CALL) {
    data.connectorId = s.connector_id;
    data.action = s.action;
    data.endpointName = s.action;
    data.connectorConfig = {
      body: s.body,
      params: s.params,
      pathParams: s.pathParams,
      headers: s.headers,
      vars: s.vars,
      installation_id: s.installation_id,
      connection_id: s.connection_id,
      database: s.database,
      timeout: s.timeout,
      then: s.then,
      else: s.else,
    };
    if (s.connector_version) {
      data.connector_version = s.connector_version;
      data.connectorConfig.connector_version = s.connector_version;
    }
  }
  if (step.type === WorkflowStepType.DB) {
    data.connectorId = s.connector_id;
    data.action = s.action;
    data.endpointName = s.action;
    data.connectorConfig = { ...s.body, then: s.then, else: s.else };
    if (s.connector_version) {
      data.connector_version = s.connector_version;
      data.connectorConfig.connector_version = s.connector_version;
    }
  }
  if (step.type === WorkflowStepType.TRANSFORM) {
    data.mapping = s.mapping;
    data.operations = s.operations;
  }
  if (step.type === WorkflowStepType.CONDITION) {
    data.conditionExpr = s.if;
    data.mode = s.mode || "jexl";
    data.then = s.then;
    data.else = s.else;
  }
  if (step.type === WorkflowStepType.VALIDATOR) {
    data.isValidatorAction = true;
    data.validationGroups = s.validationGroups;
  }
  if (step.type === WorkflowStepType.RESPONDER) {
    data.responderType = s.responder;
    data.connectorConfig = s.config;
  }
  if (step.type === WorkflowStepType.AUTHENTICATION) {
    data.connectorId = s.connector_id;
    data.action = s.action;
    data.connectorConfig = { body: s.body, then: s.then, else: s.else };
    if (s.connector_version) {
      data.connector_version = s.connector_version;
      data.connectorConfig.connector_version = s.connector_version;
    }
  }
  if (step.type === WorkflowStepType.ENCRYPTION) {
    data.connectorId = s.connector_id;
    data.action = s.action;
    data.endpointName = s.action;
    data.connectorConfig = { body: s.body, params: s.params, then: s.then, else: s.else };
    if (s.connector_version) {
      data.connector_version = s.connector_version;
      data.connectorConfig.connector_version = s.connector_version;
    }
  }
  if (step.type === WorkflowStepType.FUNCTION) {
    data.functionId = s.function_id;
    data.functionSlug = s.function_slug;
    data.connectorConfig = { args: s.args, then: s.then, else: s.else };
  }
  if (step.type === WorkflowStepType.LOG) {
    data.message = s.message;
  }
  if (step.type === WorkflowStepType.DELAY) {
    data.ms = s.ms;
  }
  return data;
}

export function stepsToNodes(workflow: IWorkflow): IWorkflowGroup {
  const trigger = workflow.trigger;
  const steps = workflow.steps || [];
  const triggerId = "trigger";
  const nodes: IWorkflowNode[] = [];
  const edges: IWorkflowEdge[] = [];

  const rawType = (trigger as any).type || WorkflowTriggerType.MANUAL;
  const triggerType = rawType === WorkflowTriggerType.WEBHOOK ? "http" : String(rawType).toLowerCase();
  const webhookPath = (trigger as any).webhook_url || "";
  const webhookMethod = (trigger as any).webhookMethod || "POST";
  const cron = (trigger as any).cron;
  const timezone = (trigger as any).timezone;
  const event = (trigger as any).event;
  const sourceConnectorId = (trigger as any).source_connector_id;
  const sourceConnectorVersion = (trigger as any).source_connector_version;

  const triggerConfig: Record<string, any> =
    triggerType === "http" || triggerType === "webhook"
      ? { webhookPath, webhookMethod }
      : triggerType === "job" || triggerType === "schedule"
        ? { cron: cron ?? "* * * * *", timezone }
        : triggerType === "event"
          ? {
              event,
              source_connector_id: sourceConnectorId,
              source_connector_version: sourceConnectorVersion,
            }
          : {};

  nodes.push({
    id: triggerId,
    type: "custom",
    position: { x: 0, y: 0 },
    data: {
      triggerType,
      webhookPath,
      webhookMethod,
      cron,
      timezone,
      event,
      source_connector_id: sourceConnectorId,
      source_connector_version: sourceConnectorVersion,
      label: "Trigger",
    },
    label: "Trigger",
  });

  const triggers = [
    { id: triggerId, type: triggerType, name: "Trigger", enabled: true, config: triggerConfig },
  ];

  steps.forEach((step, idx) => {
    const nodeId = step.id;
    const x = 250 + idx * 200;
    const y = 0;
    nodes.push({
      id: nodeId,
      type: stepTypeToNodeType(step),
      position: { x, y },
      data: stepToNodeData(step, idx),
      label: step.id,
    });
    const inputFrom = (step as any).input_from;
    const sourceId = inputFrom || triggerId;
    edges.push({
      id: `e-${sourceId}-${nodeId}`,
      source: sourceId,
      target: nodeId,
    });
    if ((step as any).then) {
      edges.push({
        id: `e-${nodeId}-then-${(step as any).then}`,
        source: nodeId,
        target: (step as any).then,
        sourceHandle: "output-if",
      });
    }
    if ((step as any).else) {
      edges.push({
        id: `e-${nodeId}-else-${(step as any).else}`,
        source: nodeId,
        target: (step as any).else,
        sourceHandle: "output-else",
      });
    }
  });

  const dataItem: IWorkflowDataItem = {
    name: workflow.name,
    type: "API",
    nodes,
    edges,
    triggers,
  };

  return {
    type: "API",
    name: workflow.name,
    status: (workflow as any).status || "active",
    project_id: (workflow as any).project_id,
    vars: (workflow as any).vars,
    data: [dataItem],
  };
}
