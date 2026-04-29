function path(...parts: string[]): string {
  return parts.filter(Boolean).join(".");
}

function expr(base: string, ...pathParts: string[]): string {
  const p = path(...pathParts);
  return p ? `{{ ${base}.${p} }}` : `{{ ${base} }}`;
}

type StepDepth = [never, 0, 1, 2, 3, 4];

export type StepKeyPath<T, D extends number = 4> = D extends 0
  ? never
  : T extends Record<string, unknown>
    ? {
        [K in keyof T & string]:
          | [K]
          | (NonNullable<T[K]> extends infer V
              ? V extends Record<string, unknown>
                ? [K, ...StepKeyPath<V, StepDepth[D]>]
                : [K]
              : [K]);
      }[keyof T & string]
    : never;

export function defineStepVars<TSteps extends Record<string, unknown>>() {
  function stepResultImpl(stepId: string, ...pathParts: string[]): string {
    const fullPath = pathParts.length > 0 ? path(stepId, ...pathParts) : stepId;
    return `{{ stepResults.${fullPath} }}`;
  }
  return {
    stepResult: stepResultImpl as {
      <K extends keyof TSteps & string>(stepId: K): string;
      <K extends keyof TSteps & string>(
        stepId: K,
        ...path: StepKeyPath<Exclude<TSteps[K], undefined>>
      ): string;
    },
  };
}

export const variable = {
  body: (...pathParts: string[]) => expr("body", ...pathParts),
  trigger: (...pathParts: string[]) => expr("trigger", ...pathParts),
  stepResult: (stepId: string, ...pathParts: string[]) => {
    const fullPath = pathParts.length > 0 ? path(stepId, ...pathParts) : stepId;
    return `{{ stepResults.${fullPath} }}`;
  },
  header: (key: string) => `{{ headers["${key}"] }}`,
  param: (key: string) => `{{ params["${key}"] }}`,
  pathParam: (key: string) => `{{ pathParams["${key}"] }}`,
  query: (key: string) => `{{ query["${key}"] }}`,
  vars: (key: string) => `{{ vars["${key}"] }}`,
  env: (key: string) => `{{ env["${key}"] }}`,
  args: (...pathParts: string[]) => expr("args", ...pathParts),
  expr: (expression: string) => `{{ ${expression} }}`,
};

export const v = variable;
