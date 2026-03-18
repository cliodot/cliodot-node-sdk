import { StepBuilder, StepResult } from "./WorkflowBuilder";
import { IWorkflowStep } from "./types/workflow";
import { IFunction, IFunctionInputSchemaItem, FunctionInputType } from "./types/function";

type FunctionStepBuilderFn = (s: StepBuilder) => StepResult | IWorkflowStep;

function sanitizeStepId(id: string): string {
  return id.replace(/[.\-\s]/g, "_");
}

function toInputSchema(input: Record<string, string>): IFunctionInputSchemaItem[] {
  return Object.entries(input).map(([name, type]) => ({
    name,
    type: (type?.toLowerCase?.() || "string") as FunctionInputType,
    required: true,
  }));
}

export class FunctionBuilder {
  private rawId: string;
  private functionId: string;
  private functionName: string;
  private inputSchema: IFunctionInputSchemaItem[] = [];
  private steps: IWorkflowStep[] = [];
  private stepOrder: string[] = [];
  private outputFromStepId: string | undefined;

  constructor(functionId: string, functionName?: string) {
    this.rawId = functionId;
    this.functionId = sanitizeStepId(functionId);
    this.functionName = functionName || functionId;
  }

  input(schema: Record<string, string>): this {
    this.inputSchema = toInputSchema(schema);
    return this;
  }

  step(stepId: string, fn: FunctionStepBuilderFn): this {
    const s = new StepBuilder();
    const result = fn(s);
    const rawStep = (result as any).step !== undefined ? (result as StepResult).step : result;
    if (!rawStep || typeof rawStep !== "object") throw new Error(`Step ${stepId} did not produce a valid step`);
    const sanitizedId = sanitizeStepId(stepId);
    const fullStep: IWorkflowStep = { ...rawStep, id: sanitizedId } as IWorkflowStep;
    this.steps.push(fullStep);
    this.stepOrder.push(stepId);
    return this;
  }

  outputFrom(stepId: string): this {
    this.outputFromStepId = sanitizeStepId(stepId);
    return this;
  }

  build(): IFunction {
    const stepsWithInputFrom: IWorkflowStep[] = [];
    for (let i = 0; i < this.steps.length; i++) {
      const step = { ...this.steps[i] };
      if (i > 0) {
        step.input_from = sanitizeStepId(this.stepOrder[i - 1]);
      }
      stepsWithInputFrom.push(step);
    }
    const fn: IFunction = {
      _id: this.functionId,
      name: this.functionName,
      slug: this.functionId,
      input_schema: this.inputSchema,
      steps: stepsWithInputFrom,
      output_from: this.outputFromStepId,
    };
    (fn as any).__rawId = this.rawId;
    return fn;
  }
}
