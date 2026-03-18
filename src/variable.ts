function path(...parts: string[]): string {
  return parts.filter(Boolean).join(".");
}

function expr(base: string, ...pathParts: string[]): string {
  const p = path(...pathParts);
  return p ? `{{ ${base}.${p} }}` : `{{ ${base} }}`;
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
