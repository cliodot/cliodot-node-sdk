/**
 * WorkflowContext – the typed context object passed to every workflow step method.
 *
 * Generic parameters:
 *  - `TInput` – shape of `ctx.input` (defaults to `Record<string, any>`)
 *  - `TSteps` – shape of `ctx.steps` / stepResults (defaults to `Record<string, any>`)
 *  - `TVars`  – shape of `ctx.vars` (defaults to `Record<string, any>`)
 *
 * Users can extend this with their own application-specific types:
 * ```ts
 * interface MyInput { email: string; password: string; }
 * interface MyVars  { token: string; }
 *
 * @Step({ order: 0 })
 * myStep(ctx: WorkflowContext<MyInput, any, MyVars>): StepOutput<{ user: User }> {
 *   const email = ctx.input.email; // typed!
 *   return { out: { user: ... } };
 * }
 * ```
 */
export interface WorkflowContext<
  TInput = Record<string, any>,
  TSteps = Record<string, any>,
  TVars = Record<string, any>,
> {
  /** The input data for this step – typically the result of a previous step or the trigger payload */
  input: TInput;

  /** The trigger payload that initiated the workflow (HTTP body, webhook data, etc.) */
  trigger: any;

  /** Accumulated step results keyed by step id */
  steps: TSteps;

  /** Workflow-level variables (can be set/read across steps via `setVars`) */
  vars: TVars;

  /** HTTP headers from the incoming request */
  headers?: Record<string, string>;

  /** Merged query + route params */
  params?: Record<string, any>;

  /** URL path parameters */
  pathParams?: Record<string, any>;

  /** Query string parameters */
  query?: Record<string, any>;

  /** Request body (raw) */
  body?: any;

  /** Environment variables passed at runtime */
  env?: Record<string, string>;

  /** Allow users to access additional custom properties */
  [key: string]: any;
}

/**
 * StepOutput – the standard return type for workflow step methods.
 *
 * Every step that produces output must return `{ out: T }`.
 * The framework extracts the `out` value and stores it in `stepResults[stepId]`.
 *
 * Optionally include `setVars` to update workflow-level variables.
 *
 * ```ts
 * @Step({ order: 0 })
 * myStep(ctx: WorkflowContext<MyInput>): StepOutput<{ userId: string }> {
 *   return { out: { userId: '123' } };
 * }
 *
 * // With setVars:
 * @Step({ order: 1 })
 * anotherStep(ctx: WorkflowContext): StepOutput<{ ok: boolean }> {
 *   return {
 *     out: { ok: true },
 *     setVars: { token: 'abc' },
 *   };
 * }
 * ```
 */
export interface StepOutput<T = any> {
  /** The output payload for this step */
  out: T;
  /** Optional: set workflow-level variables */
  setVars?: Record<string, any>;
}

