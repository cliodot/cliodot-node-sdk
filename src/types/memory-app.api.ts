export type MemoryAppClientConfig = {
  baseUrl: string;
  appId: string;
  apiKey?: string;
  appApiKey?: string;
  appSecret?: string;
  debug?: boolean;
  /** Pin project env bag for connector auth templates. Omit to follow the project switch. */
  environment?: "dev" | "prod" | "development" | "production";
};

export type MemoryObjectSource = {
  type: string;
  id?: string;
  label?: string;
  metadata?: Record<string, unknown>;
};

export type MemoryObject = {
  _id: string;
  tenant_id: string;
  memory_app_id: string;
  collection_id: string;
  type: string;
  title?: string;
  content: unknown;
  search_text: string;
  metadata: Record<string, unknown>;
  tags: string[];
  source?: MemoryObjectSource;
  version: number;
  deleted_at?: string | Date | null;
  created_by?: string;
  createdAt?: string | Date;
  updatedAt?: string | Date;
};

export type MemoryStoreInput = {
  collection: string;
  content: unknown;
  type?: string;
  title?: string;
  metadata?: Record<string, unknown>;
  tags?: string[];
  source?: MemoryObjectSource;
  id?: string;
  async?: boolean;
};

export type MemoryStoreResponse = {
  ok: true;
  object: MemoryObject;
  ingestion_job_id?: string;
};

export type MemoryStoreManyInput = {
  collection: string;
  items: Array<Omit<MemoryStoreInput, "collection"> & { collection?: string }>;
};

export type MemoryStoreManyResponse = {
  ok: true;
  objects: MemoryObject[];
  ingestion_job_ids: string[];
};

export type MemoryAddressInput = {
  collection: string;
  id: string;
};

export type MemoryUpdateInput = MemoryAddressInput & {
  content?: unknown;
  type?: string;
  title?: string;
  metadata?: Record<string, unknown>;
  tags?: string[];
  source?: MemoryObjectSource;
  async?: boolean;
};

export type MemoryDeleteInput = MemoryAddressInput & {
  mode?: MemoryDeleteMode;
};

export type MemoryFindInput = {
  collection: string;
  filter?: Record<string, unknown>;
  type?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
  limit?: number;
  offset?: number;
};

export type MemoryFindResponse = {
  ok: true;
  objects: MemoryObject[];
  total: number;
};

export type MemorySearchMode =
  | "exact"
  | "filter"
  | "text"
  | "semantic"
  | "hybrid";

export type MemorySearchInput = {
  query?: string;
  mode?: MemorySearchMode;
  collection?: string;
  collections?: string[];
  apps?: string[];
  group?: string;
  metadata?: Record<string, unknown>;
  tags?: string[];
  limit?: number;
  offset?: number;
};

export type MemorySearchHit = {
  memory_app: string;
  collection: string;
  score: number;
  object: MemoryObject;
};

export type MemorySearchResponse = {
  ok: true;
  results: MemorySearchHit[];
  total: number;
  mode: MemorySearchMode;
};

export type MemoryCrossSearchInput = MemorySearchInput;

export type MemoryDeleteMode = "soft" | "permanent";

export type MemoryAppClientApi = {
  store: (input: MemoryStoreInput) => Promise<MemoryStoreResponse>;
  storeMany: (input: MemoryStoreManyInput) => Promise<MemoryStoreManyResponse>;
  get: (
    input: MemoryAddressInput
  ) => Promise<{ ok: true; object: MemoryObject }>;
  update: (input: MemoryUpdateInput) => Promise<MemoryStoreResponse>;
  delete: (
    input: MemoryDeleteInput
  ) => Promise<{ ok: true; deleted: boolean; mode: MemoryDeleteMode }>;
  find: (input: MemoryFindInput) => Promise<MemoryFindResponse>;
  search: (input: MemorySearchInput) => Promise<MemorySearchResponse>;
};

export type MemoryClientConfig = MemoryAppClientConfig;

export type MemoryClientApi = {
  searchCross: (input: MemoryCrossSearchInput) => Promise<MemorySearchResponse>;
  search: (input: MemorySearchInput) => Promise<MemorySearchResponse>;
};
