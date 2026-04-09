import type { IWorkflow } from "../types/workflow";
import { WorkflowStepType, WorkflowTriggerType } from "../types/workflow";
import type { WorkflowDecoratorsMeta } from "./metadata";
import { getOrCreateWorkflowMeta, inferWorkflowIdFromClassName, sanitizeStepId, withThenElse } from "./metadata";

export function buildWorkflowFromClass(workflowClass: any): IWorkflow {
  const meta = getOrCreateWorkflowMeta(workflowClass) as WorkflowDecoratorsMeta;
  const workflowIdRaw = meta.workflowId ?? inferWorkflowIdFromClassName(workflowClass?.name ?? "workflow");
  const workflowName = meta.workflowName ?? workflowIdRaw;

  const sortedSteps = [...(meta.steps ?? [])].sort((a, b) => a.orderKey - b.orderKey);

  const steps: any[] = [];
  let prevMainStepId: string | undefined = undefined;

  for (const s of sortedSteps) {
    const mainId = sanitizeStepId(s.stepId);
    const stage = s.stage ?? "pre";

    const methodFn = workflowClass?.prototype?.[s.methodKey];
    let extractedBody: string | undefined = undefined;
    if (typeof methodFn === "function") {
      const methodSource = methodFn.toString();
      const openIdx = methodSource.indexOf("{");
      const closeIdx = methodSource.lastIndexOf("}");
      if (openIdx >= 0 && closeIdx > openIdx) {
        let body = methodSource.slice(openIdx + 1, closeIdx);
        body = body.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "").trim();
        if (body.length > 0) extractedBody = body;
      }
    }

    let mainStep: any = s.factory(mainId);

    if (stage === "post" && extractedBody) {
      mainStep.post_source = extractedBody;
    }

    mainStep = withThenElse(mainStep, s.then, s.else);

    const hasPreInjection = stage === "pre" && extractedBody;
    const preId = hasPreInjection ? `${mainId}_pre` : undefined;
    mainStep.input_from = hasPreInjection ? preId : prevMainStepId;
    steps.push(mainStep);

    if (stage === "pre" && extractedBody) {
      steps.splice(steps.length - 1, 0, {
        id: preId,
        type: WorkflowStepType.CODE,
        source: extractedBody,
        input_from: prevMainStepId,
      });
    }

    prevMainStepId = mainId;
  }

  const trigger = meta.trigger ?? { type: WorkflowTriggerType.MANUAL };

  const workflow: any = {
    _id: sanitizeStepId(workflowIdRaw),
    name: workflowName,
    trigger,
    steps,
    status: "active",
    __rawId: workflowIdRaw,
  };
  return workflow as IWorkflow;
}

export function buildConnectorFromClass(ConnectorClass: any): Record<string, any> {
  const meta = ConnectorClass[Symbol.for("cliodot:connectorMeta")] as any;
  if (!meta) {
    throw new Error(`Class ${ConnectorClass.name} is not decorated with @ConnectorClass`);
  }
  
  const actionsMap: Record<string, string> = {};
  const endpoints: any[] = [];
  
  for (const action of meta.actions) {
    actionsMap[action.methodKey] = action.actionName;
    if (action.type === "endpoint") {
        endpoints.push({
            name: action.actionName,
            method: action.httpConfig.method,
            path: action.httpConfig.path,
            ...action.httpConfig, // includes config object
        });
    }
  }

  const instance = new ConnectorClass();

  const connectorDef: any = {
    _id: meta.connectorId,
    id: meta.connectorId, // keeping id for backwards compatibility
    name: meta.connectorName,
    actions: actionsMap,
    ...meta.config, // Spread user provided config (type: "REST", base_url, auth, etc.)
  };

  // If endpoints are found, attach them as REST mappings natively.
  if (endpoints.length > 0) {
      connectorDef.endpoints = endpoints;
  }

  const hasCustomActions = meta.actions.some((a: any) => a.type === "custom");
  if (hasCustomActions) {
    connectorDef.execute = async (actionName: string, options: any) => {
      const actionMeta = meta.actions.find(
        (a: any) =>
          a.actionName === actionName ||
          a.methodKey === actionName ||
          actionsMap[a.methodKey] === actionName
      );
      if (!actionMeta) throw new Error(`Action ${actionName} not found on connector ${meta.connectorId}`);

      if (actionMeta.type === "custom") {
        return instance[actionMeta.methodKey](options);
      }
      throw new Error(`Action ${actionName} is an HTTP endpoint and should be executed by the SDK runner inherently.`);
    };
  }

  return connectorDef;
}

