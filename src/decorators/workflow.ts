import type { HttpMethod } from "../types/builtin";
import { WorkflowTriggerType } from "../types/workflow";
import { getOrCreateWorkflowMeta, type WorkflowDecoratorsTrigger } from "./metadata";

export function Workflow(workflowId?: string, workflowName?: string) {
  return function (ctor: any) {
    const meta = getOrCreateWorkflowMeta(ctor);
    if (workflowId) meta.workflowId = workflowId;
    if (workflowName) meta.workflowName = workflowName;
  };
}

export function Http(method: HttpMethod, path: string) {
  return function (ctor: any) {
    const meta = getOrCreateWorkflowMeta(ctor);
    const trigger: WorkflowDecoratorsTrigger = {
      type: WorkflowTriggerType.HTTP,
      webhook_url: path,
      webhookMethod: method,
    };
    meta.trigger = trigger;
  };
}

export function Webhook(method: HttpMethod, path: string) {
  return Http(method, path);
}

export function Job(cron?: string, timezone?: string) {
  return function (ctor: any) {
    const meta = getOrCreateWorkflowMeta(ctor);
    meta.trigger = {
      type: WorkflowTriggerType.JOB,
      cron: cron ?? "* * * * *",
      timezone,
    };
  };
}

export function Schedule(cron: string, timezone?: string) {
  return function (ctor: any) {
    const meta = getOrCreateWorkflowMeta(ctor);
    meta.trigger = {
      type: WorkflowTriggerType.SCHEDULE,
      cron,
      timezone,
    };
  };
}

