import { AxiosInstance } from "axios";
import { CliodotApiError, cliodotApiErrorFromAxios } from "./errors";
import { createCliodotAxios } from "./http/create-client";
import { parseApiErrorCode, parseApiErrorMessage } from "./http/parse-api-error";
import { applyEnvironmentHeader } from "./http/cliodot-request";
import type {
  MemoryAddressInput,
  MemoryAppClientApi,
  MemoryAppClientConfig,
  MemoryDeleteInput,
  MemoryFindInput,
  MemoryFindResponse,
  MemoryObject,
  MemorySearchInput,
  MemorySearchResponse,
  MemoryStoreInput,
  MemoryStoreManyInput,
  MemoryStoreManyResponse,
  MemoryStoreResponse,
  MemoryUpdateInput,
} from "./types/memory-app.api";

function trimBaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

export class MemoryAppClient implements MemoryAppClientApi {
  private readonly baseUrl: string;
  private readonly appId: string;
  private readonly apiKey?: string;
  private readonly appSecret?: string;
  private readonly environment?: string;
  private readonly axios: AxiosInstance;
  public readonly debug: boolean;

  constructor(config: MemoryAppClientConfig) {
    if (!config.baseUrl?.trim()) {
      throw new CliodotApiError("MemoryAppClient requires baseUrl");
    }
    if (!config.appId?.trim()) {
      throw new CliodotApiError("MemoryAppClient requires appId");
    }
    this.baseUrl = trimBaseUrl(config.baseUrl);
    this.appId = config.appId.trim();
    this.apiKey =
      config.apiKey?.trim() || config.appApiKey?.trim() || undefined;
    this.appSecret = config.appSecret?.trim() || undefined;
    this.environment = config.environment;
    this.debug = config.debug ?? false;
    this.axios = createCliodotAxios({
      baseURL: `${this.baseUrl}/memory`,
      timeout: 60000,
      headers: { "Content-Type": "application/json" },
    });
  }

  store(input: MemoryStoreInput): Promise<MemoryStoreResponse> {
    if (!input?.collection?.trim()) {
      throw new CliodotApiError("collection is required");
    }
    if (input.content === undefined) {
      throw new CliodotApiError("content is required");
    }
    return this.request<MemoryStoreResponse>("POST", "/v1/store", {
      ...input,
      collection: input.collection.trim(),
    });
  }

  storeMany(input: MemoryStoreManyInput): Promise<MemoryStoreManyResponse> {
    if (!input?.collection?.trim()) {
      throw new CliodotApiError("collection is required");
    }
    if (!Array.isArray(input.items) || input.items.length === 0) {
      throw new CliodotApiError("items is required");
    }
    return this.request<MemoryStoreManyResponse>("POST", "/v1/store-many", {
      collection: input.collection.trim(),
      items: input.items,
    });
  }

  get(
    input: MemoryAddressInput
  ): Promise<{ ok: true; object: MemoryObject }> {
    if (!input?.collection?.trim() || !input?.id?.trim()) {
      throw new CliodotApiError("collection and id are required");
    }
    return this.request("POST", "/v1/get", {
      collection: input.collection.trim(),
      id: input.id.trim(),
    });
  }

  update(input: MemoryUpdateInput): Promise<MemoryStoreResponse> {
    if (!input?.collection?.trim() || !input?.id?.trim()) {
      throw new CliodotApiError("collection and id are required");
    }
    return this.request<MemoryStoreResponse>("POST", "/v1/update", {
      collection: input.collection.trim(),
      id: input.id.trim(),
      content: input.content,
      type: input.type,
      title: input.title,
      metadata: input.metadata,
      tags: input.tags,
      source: input.source,
      async: input.async,
    });
  }

  delete(
    input: MemoryDeleteInput
  ): Promise<{ ok: true; deleted: boolean; mode: "soft" | "permanent" }> {
    if (!input?.collection?.trim() || !input?.id?.trim()) {
      throw new CliodotApiError("collection and id are required");
    }
    return this.request("POST", "/v1/delete", {
      collection: input.collection.trim(),
      id: input.id.trim(),
      mode: input.mode || "soft",
    });
  }

  find(input: MemoryFindInput): Promise<MemoryFindResponse> {
    if (!input?.collection?.trim()) {
      throw new CliodotApiError("collection is required");
    }
    return this.request<MemoryFindResponse>("POST", "/v1/find", {
      collection: input.collection.trim(),
      filter: input.filter,
      type: input.type,
      tags: input.tags,
      metadata: input.metadata,
      limit: input.limit,
      offset: input.offset,
    });
  }

  search(input: MemorySearchInput): Promise<MemorySearchResponse> {
    return this.request<MemorySearchResponse>("POST", "/v1/search", input);
  }

  private buildAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = applyEnvironmentHeader(
      {
        "x-cliodot-app-id": this.appId,
      },
      this.environment
    );
    if (this.apiKey) {
      headers.Authorization = `Bearer ${this.apiKey}`;
      return headers;
    }
    if (this.appSecret) {
      headers["x-cliodot-app-secret"] = this.appSecret;
      return headers;
    }
    throw new CliodotApiError(
      "MemoryAppClient credentials required (apiKey/appApiKey or appSecret)"
    );
  }

  private async request<T>(
    method: string,
    path: string,
    body?: Record<string, unknown>
  ): Promise<T> {
    try {
      const { data } = await this.axios({
        method,
        url: path,
        headers: this.buildAuthHeaders(),
        data: body,
      });
      if (data?.ok === false) {
        throw new CliodotApiError(
          parseApiErrorMessage(data) || "Memory request failed",
          {
            data,
            code: parseApiErrorCode(data),
          }
        );
      }
      return data as T;
    } catch (err: any) {
      if (err instanceof CliodotApiError) {
        throw err;
      }
      throw cliodotApiErrorFromAxios(
        err,
        `Request failed: ${method} ${path}`
      );
    }
  }
}
