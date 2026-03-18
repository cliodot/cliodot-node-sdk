export type FunctionInputType =
  | "string"
  | "number"
  | "boolean"
  | "object"
  | "array"
  | "integer"
  | "null";

export interface IFunctionInputSchemaItem {
  name: string;
  type: FunctionInputType;
  required?: boolean;
  default?: any;
  description?: string;
  items?: { type: FunctionInputType };
  properties?: Record<string, { type: FunctionInputType; description?: string }>;
}

export interface IFunctionOutputSchema {
  type?: FunctionInputType | "any";
  description?: string;
  properties?: Record<string, any>;
  items?: Record<string, any>;
  path?: "then" | "else";
}

export interface IFunctionOutputSchemaValue {
  type?: FunctionInputType | "any";
  description?: string;
  properties?: Record<string, any>;
  items?: Record<string, any>;
  path?: "then" | "else";
}

export interface IFunctionDataItem {
  name: string;
  triggers?: unknown[];
  nodes: IFunctionNode[];
  edges: IFunctionEdge[];
  metadata?: Record<string, any>;
}

export interface IFunctionNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: Record<string, any>;
  label: string;
}

export interface IFunctionEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  type?: string;
}

export interface IFunction {
  _id?: string;
  name: string;
  slug?: string;
  description?: string;
  input_schema: IFunctionInputSchemaItem[];
  output_schema?: IFunctionOutputSchemaValue;
  steps: any[];
  output_from?: string;
  data?: IFunctionDataItem[];
}
