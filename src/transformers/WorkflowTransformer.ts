import { IWorkflow, IWorkflowStep, IWorkflowTrigger, WorkflowStepType, WorkflowTriggerType } from "../types/workflow";

interface INode {
  id: string;
  type: string;
  data: Record<string, any>;
}

interface IEdge {
  source: string;
  target: string;
  sourceHandle?: string;
}

interface IDataItem {
  name: string;
  nodes: INode[];
  edges: IEdge[];
  triggers?: Array<{ id: string; type: string; config?: any }>;
}

function sanitize(id: string): string {
  return id.replace(/[.\-\s]/g, "_");
}

function buildDependencyGraph(edges: IEdge[]): Map<string, string[]> {
  const graph = new Map<string, string[]>();
  edges.forEach((e) => {
    if (!graph.has(e.target)) graph.set(e.target, []);
    graph.get(e.target)!.push(e.source);
  });
  return graph;
}

function topologicalSort(nodes: INode[], graph: Map<string, string[]>, triggerId: string): string[] {
  const result: string[] = [];
  const visited = new Set<string>();
  const visit = (id: string) => {
    if (id === triggerId || visited.has(id)) return;
    visited.add(id);
    (graph.get(id) || []).forEach(visit);
    result.push(id);
  };
  nodes.forEach((n) => visit(n.id));
  return result;
}

export class WorkflowTransformer {
  static transform(
    dataItem: IDataItem,
    workflowId: string,
    tenantId: string,
    vars?: Record<string, any>,
    projectId?: string
  ): IWorkflow {
    const triggerNode = dataItem.nodes.find((n) => n.type === "custom" && (n.data as any).triggerType);
    if (!triggerNode) throw new Error("No trigger node found");
    const triggerData = triggerNode.data as any;
    const triggerType = (triggerData.triggerType || "manual").toLowerCase();
    let trigger: IWorkflowTrigger = { type: WorkflowTriggerType.MANUAL };
    if (triggerType === "http" || triggerType === "webhook") {
      trigger = {
        type: WorkflowTriggerType.HTTP,
        webhook_url: triggerData.webhookPath || triggerData.config?.webhookPath || "",
      };
      (trigger as any).webhookMethod = triggerData.webhookMethod || triggerData.config?.webhookMethod || "POST";
    } else if (triggerType === "job") {
      trigger = {
        type: WorkflowTriggerType.JOB,
        cron: triggerData.cron || triggerData.config?.cron || "* * * * *",
        timezone: triggerData.timezone || triggerData.config?.timezone,
      };
    } else if (triggerType === "schedule") {
      trigger = {
        type: WorkflowTriggerType.SCHEDULE,
        cron: triggerData.cron || triggerData.config?.cron,
        timezone: triggerData.timezone || triggerData.config?.timezone,
      };
    }
    const graph = buildDependencyGraph(dataItem.edges);
    const order = topologicalSort(dataItem.nodes, graph, triggerNode.id);
    const steps: IWorkflowStep[] = [];
    const nodeIdToStepId = new Map<string, string>();
    order.forEach((nodeId) => {
      const node = dataItem.nodes.find((n) => n.id === nodeId);
      if (!node) return;
      const deps = graph.get(node.id) || [];
      const inputFrom = deps.find((d) => d !== triggerNode.id);
      const stepId = sanitize(node.id);
      nodeIdToStepId.set(node.id, stepId);
      const data = node.data as any;
      const baseStep: any = { id: stepId };
      if (inputFrom) baseStep.input_from = nodeIdToStepId.get(inputFrom) || sanitize(inputFrom);
      const cfg = data.connectorConfig || {};
      const addThenElse = (step: any) => {
        if (cfg.then) step.then = sanitize(cfg.then);
        if (cfg.else) step.else = sanitize(cfg.else);
      };
      if (node.type === "connector_api" || node.type === "api_call") {
        if (data.responderType) {
          baseStep.type = WorkflowStepType.RESPONDER;
          baseStep.responder = data.responderType;
          baseStep.config = cfg;
        } else if (data.isValidatorAction) {
          baseStep.type = WorkflowStepType.VALIDATOR;
          baseStep.validationGroups = data.validationGroups || [];
        } else {
          baseStep.type = WorkflowStepType.API_CALL;
          baseStep.connector_id = data.connectorId;
          baseStep.action = data.action || data.endpointName || data.endpointId;
          baseStep.params = cfg.params || {};
          baseStep.pathParams = cfg.pathParams || cfg.params || {};
          baseStep.body = cfg.body || {};
          addThenElse(baseStep);
        }
      } else if (node.type === "connector_db") {
        baseStep.type = WorkflowStepType.DB;
        baseStep.connector_id = data.connectorId;
        baseStep.action = data.action || data.endpointId;
        baseStep.body = cfg.body || cfg;
        addThenElse(baseStep);
      } else if (node.type === "transform") {
        baseStep.type = WorkflowStepType.TRANSFORM;
        baseStep.mapping = data.mapping;
        baseStep.operations = data.operations;
      } else if (node.type === "condition") {
        baseStep.type = WorkflowStepType.CONDITION;
        baseStep.mode = data.mode || "jexl";
        baseStep.if = data.conditionExpr || data.if;
        baseStep.then = data.then ? sanitize(data.then) : undefined;
        baseStep.else = data.else ? sanitize(data.else) : undefined;
      } else if (node.type === "authentication") {
        baseStep.type = WorkflowStepType.AUTHENTICATION;
        baseStep.connector_id = data.connectorId;
        baseStep.action = data.action;
        baseStep.body = cfg.body || {};
        addThenElse(baseStep);
      } else if (node.type === "function") {
        baseStep.type = WorkflowStepType.FUNCTION;
        baseStep.function_id = data.functionId || data.functionSlug;
        baseStep.function_slug = data.functionSlug || data.functionId;
        baseStep.args = cfg.args || {};
        addThenElse(baseStep);
      } else if (node.type === "log") {
        baseStep.type = WorkflowStepType.LOG;
        baseStep.message = data.message || "";
      } else if (node.type === "delay") {
        baseStep.type = WorkflowStepType.DELAY;
        baseStep.ms = data.ms || 0;
      } else {
        return;
      }
      steps.push(baseStep);
    });
    return {
      _id: sanitize(workflowId),
      tenant_id: tenantId,
      project_id: projectId,
      name: dataItem.name,
      trigger,
      steps,
      status: "active",
      vars,
    } as IWorkflow;
  }
}
