import type {
  IdentityAuthenticateResponse,
  IdentityTokenCacheOptions,
} from "./types/identity-app.api";
import { CliodotApiError } from "./errors";

type CachedToken = {
  access_token: string;
  refresh_token?: string;
  expires_at: number;
};

export function createIdentityTokenCache(options: IdentityTokenCacheOptions) {
  const store = new Map<string, CachedToken>();
  const skewSeconds = options.skewSeconds ?? 60;

  async function getAccessToken(targetAppId: string): Promise<string> {
    if (!targetAppId?.trim()) {
      throw new CliodotApiError("targetAppId is required");
    }
    const key = targetAppId.trim();
    const cached = store.get(key);
    const now = Date.now();
    if (cached && cached.expires_at - skewSeconds * 1000 > now) {
      return cached.access_token;
    }

    let tokens: IdentityAuthenticateResponse;
    if (cached?.refresh_token) {
      try {
        tokens = await options.client.refresh({
          refresh_token: cached.refresh_token,
        });
      } catch {
        tokens = await options.client.authenticate({
          target_app_id: key,
        });
      }
    } else {
      tokens = await options.client.authenticate({
        target_app_id: key,
      });
    }

    store.set(key, {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: Date.now() + Math.max(1, tokens.expires_in) * 1000,
    });
    return tokens.access_token;
  }

  function clear(targetAppId?: string): void {
    if (targetAppId?.trim()) {
      store.delete(targetAppId.trim());
      return;
    }
    store.clear();
  }

  return { getAccessToken, clear };
}
