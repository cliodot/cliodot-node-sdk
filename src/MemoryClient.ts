import { MemoryAppClient } from "./MemoryAppClient";
import type {
  MemoryClientApi,
  MemoryClientConfig,
  MemoryCrossSearchInput,
  MemorySearchInput,
  MemorySearchResponse,
} from "./types/memory-app.api";
import { CliodotApiError } from "./errors";

export class MemoryClient extends MemoryAppClient implements MemoryClientApi {
  constructor(config: MemoryClientConfig) {
    super(config);
  }

  search(input: MemorySearchInput): Promise<MemorySearchResponse> {
    return super.search(input);
  }

  searchCross(input: MemoryCrossSearchInput): Promise<MemorySearchResponse> {
    if (!input?.apps?.length && !input?.group?.trim()) {
      throw new CliodotApiError("apps[] or group is required");
    }
    return this.search(input);
  }
}
