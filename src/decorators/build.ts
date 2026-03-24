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

