export interface IConnectorAuth {
  type: string;
  token?: string;
  header_name?: string;
  prefix?: string;
  query_param?: string;
  mode?: string;
  fields?: Record<string, any>;
}

export interface IConnectorEndpoint {
  name: string;
  method: string;
  path: string;
  description?: string;
  headers?: Record<string, string>;
  body_schema?: Record<string, any>;
}

export interface IConnectorAction {
  id: string;
  name: string;
  inputs?: Record<string, any>;
}

export interface IConnectorMeta {
  category?: string;
  logo?: string;
}

export interface IConnector {
  _id: string;
  name: string;
  slug?: string;
  description?: string;
  type: "REST" | "SOAP" | "GRAPHQL" | "system";
  base_url?: string;
  auth: IConnectorAuth;
  endpoints?: IConnectorEndpoint[];
  actions?: IConnectorAction[];
  meta?: IConnectorMeta;
}

export interface ConnectorExecuteOptions {
  body?: Record<string, unknown>;
  params?: Record<string, unknown>;
  pathParams?: Record<string, unknown>;
  headers?: Record<string, string>;
  database?: string;
  connection_id?: string;
  timeout?: number;
}

export interface ConnectorContext {
  headers?: Record<string, string>;
  connectorConfig?: Record<string, Record<string, unknown>>;
  env?: Record<string, string>;
  trigger?: Record<string, unknown>;
  stepResults?: Record<string, unknown>;
  vars?: Record<string, unknown>;
}

export type ConnectorExecuteFn = (
  action: string,
  options: ConnectorExecuteOptions,
  context: ConnectorContext
) => Promise<unknown>;
