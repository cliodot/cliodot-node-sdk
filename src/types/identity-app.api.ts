export type IdentityAppClientConfig = {
  baseUrl: string;
  appId: string;
  apiKey?: string;
  appApiKey?: string;
  appSecret?: string;
  debug?: boolean;
  timeoutMs?: number;
};

export type IdentityAuthenticateInput = {
  target_app_id: string;
  scopes?: string | string[];
};

export type IdentityAuthenticateResponse = {
  ok: true;
  access_token: string;
  token_type: "Bearer";
  expires_in: number;
  refresh_token?: string;
  refresh_expires_in?: number;
  caller_app_id: string;
  target_app_id: string;
};

export type IdentityMeResponse = {
  ok: true;
  app: {
    _id: string;
    name: string;
    slug: string;
    tenant_id: string;
    status: string;
  };
};

export type IdentityVerifyInput = {
  access_token: string;
  target_app_id?: string;
  required_scopes?: string[];
};

export type IdentityVerifyResponse = {
  ok: true;
  valid: true;
  jti: string;
  caller_app_id: string;
  target_app_id: string;
  expires_at: string;
  claims: Record<string, unknown>;
};

export type IdentityRefreshInput = {
  refresh_token: string;
};

export type IdentityRevokeInput = {
  access_token?: string;
  refresh_token?: string;
};

export type IdentityRevokeResponse = {
  ok: true;
  revoked: boolean;
};

export type IdentityJwks = {
  keys: Array<Record<string, string>>;
};

export type IdentityOfflineVerifyHs256 = {
  algorithm: "HS256";
  secret: string;
};

export type IdentityOfflineVerifyRs256 = {
  algorithm: "RS256";
  jwksUrl?: string;
  publicKeyPem?: string;
  cacheTtlMs?: number;
  fetch?: typeof fetch;
};

export type IdentityOfflineVerifyOptions =
  | IdentityOfflineVerifyHs256
  | IdentityOfflineVerifyRs256;

export type IdentityTokenCacheOptions = {
  client: {
    authenticate: (
      input: IdentityAuthenticateInput
    ) => Promise<IdentityAuthenticateResponse>;
    refresh: (
      input: IdentityRefreshInput
    ) => Promise<IdentityAuthenticateResponse>;
  };
  skewSeconds?: number;
};

export type IdentityProviderHandle = {
  target_app_id: string;
  authenticate(scopes?: string | string[]): Promise<IdentityAuthenticateResponse>;
  verify(
    accessToken: string,
    required_scopes?: string[]
  ): Promise<IdentityVerifyResponse>;
  refresh(refreshToken: string): Promise<IdentityAuthenticateResponse>;
};

export type IdentityAppClientApi = {
  me(): Promise<IdentityMeResponse>;
  authenticate(
    input: IdentityAuthenticateInput
  ): Promise<IdentityAuthenticateResponse>;
  verify(input: IdentityVerifyInput): Promise<IdentityVerifyResponse>;
  refresh(input: IdentityRefreshInput): Promise<IdentityAuthenticateResponse>;
  revoke(input: IdentityRevokeInput): Promise<IdentityRevokeResponse>;
  getJwks(appId: string): Promise<IdentityJwks>;
  provider(name: string): IdentityProviderHandle;
  extProvider(name: string): IdentityProviderHandle;
};
