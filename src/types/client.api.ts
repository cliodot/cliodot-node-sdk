import type { IWorkflow } from "./workflow";
import type { IFunction } from "./function";

export interface ConnectorsListOptions {
  type?: string;
  status?: string;
  category?: string;
  page?: number;
  limit?: number;
}

export interface ConnectorsListResult {
  connectors: any[];
  pagination?: any;
}

export interface ConnectorsSearchOptions {
  term?: string;
  category?: string;
  page?: number;
  limit?: number;
}

export interface ConnectorsInstalledOptions {
  status?: string;
  page?: number;
  limit?: number;
}

export interface ConnectorsInstalledResult {
  installations: any[];
  pagination?: any;
}

export interface ConnectorsExecuteOptions {
  body?: Record<string, any>;
  params?: Record<string, any>;
  pathParams?: Record<string, any>;
  headers?: Record<string, string>;
  installation_id?: string;
  database?: string;
  connection_id?: string;
  timeout?: number;
  vars?: Record<string, any>;
  connector_version?: string;
}

export interface ConnectorsApi {
  get(connectorId: string, options?: { semver?: string; version?: string }): Promise<any>;
  list(options?: ConnectorsListOptions): Promise<ConnectorsListResult>;
  search(options?: ConnectorsSearchOptions): Promise<ConnectorsListResult>;
  installed(options?: ConnectorsInstalledOptions): Promise<ConnectorsInstalledResult>;
  push(connector: Record<string, any>): Promise<any>;
  install(connectorId: string, options?: { auth?: any; base_url?: string; version?: string }): Promise<any>;
  uninstall(connectorId: string): Promise<any>;
  execute(connectorId: string, action: string, options?: ConnectorsExecuteOptions): Promise<any>;
}

export interface WorkflowsListOptions {
  status?: string;
  type?: string;
  name?: string;
  project_id?: string;
  page?: number;
  limit?: number;
}

export interface WorkflowsListResult {
  workflowGroups: any[];
  pagination?: any;
}

export interface WorkflowsApi {
  push(workflow: IWorkflow): Promise<any>;
  pull(groupId: string): Promise<IWorkflow>;
  list(options?: WorkflowsListOptions): Promise<WorkflowsListResult>;
  run(
    groupId: string,
    triggerId: string,
    payload?: { payload?: any; environment?: "dev" | "prod"; executionHeaders?: Record<string, string> }
  ): Promise<any>;
  runByWebhook(
    webhookPath: string,
    method: string,
    payload?: { body?: any; environment?: "dev" | "prod"; executionHeaders?: Record<string, string> } & Record<string, any>
  ): Promise<any>;
  promote(groupId: string): Promise<any>;
}

export interface FunctionsApi {
  list(): Promise<any[]>;
  push(fn: IFunction): Promise<any>;
  pull(functionId: string): Promise<IFunction>;
  invoke(functionId: string, args: Record<string, any>): Promise<any>;
  invokePublic(slug: string, args: Record<string, any>): Promise<any>;
}

export interface ProjectsApi {
  create(input: { name: string; description?: string }): Promise<any>;
  list(): Promise<any[]>;
  get(projectId: string): Promise<any>;
  update(projectId: string, input: any): Promise<any>;
  delete(projectId: string): Promise<any>;
  setEnvironmentVariables(
    projectId: string,
    input: { environment?: string; variables: Record<string, string>; is_secret?: boolean }
  ): Promise<any>;
  listEnvironmentVariables(projectId: string): Promise<any>;
  switchEnvironment(projectId: string, environment: string): Promise<any>;
}

export interface FlosyncClientApi {
  connectors: ConnectorsApi;
  workflows: WorkflowsApi;
  functions: FunctionsApi;
  projects: ProjectsApi;
  authenticate(): Promise<void>;
}
