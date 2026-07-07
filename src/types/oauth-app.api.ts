export enum OAuthConnectionStorage {
  PERSISTENT = "persistent",
  EPHEMERAL = "ephemeral",
}

export enum OAuthConnectionStatus {
  ACTIVE = "active",
  EXPIRED = "expired",
  REVOKED = "revoked",
  ERROR = "error",
}

export enum OAuthTokenExposurePolicy {
  METADATA_ONLY = "metadata_only",
  INCLUDE_ACCESS_TOKEN = "include_access_token",
  INCLUDE_REFRESH_TOKEN = "include_refresh_token",
}

export type OAuthAppErrorCode =
  | "OAUTH_APP_NOT_FOUND"
  | "OAUTH_PROVIDER_NOT_CONFIGURED"
  | "OAUTH_APP_DISABLED"
  | "OAUTH_REDIRECT_URI_NOT_ALLOWED"
  | "OAUTH_SCOPE_NOT_ALLOWED"
  | "OAUTH_STATE_INVALID"
  | "OAUTH_EXCHANGE_CODE_INVALID"
  | "OAUTH_CREDENTIALS_MISSING"
  | "OAUTH_PROVIDER_ERROR"
  | "OAUTH_CONNECTION_REVOKED"
  | "OAUTH_UNAUTHORIZED_APP"
  | "OAUTH_CONNECTOR_INVALID"
  | "OAUTH_PROVIDER_DISABLED"
  | "OAUTH_CONNECTION_EXPIRED";

export interface OAuthAppClientConfig {
  baseUrl: string;
  appId: string;
  appApiKey?: string;
  appSecret?: string;
  debug?: boolean;
}

export interface OAuthConnectionIdentity {
  provider: string;
  provider_user_id: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
}

export interface OAuthSanitizedConnection {
  id: string;
  oauth_app_id: string;
  provider: string;
  storage_mode: OAuthConnectionStorage;
  status: OAuthConnectionStatus;
  external_user_key?: string;
  identity: OAuthConnectionIdentity;
  scopes_granted: string[];
  expires_at?: string;
  storage_expires_at?: string | null;
  last_refreshed_at?: string | null;
  last_used_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface OAuthTokenFields {
  access_token?: string;
  refresh_token?: string;
  token_type?: string;
  expires_at?: string;
}

export interface OAuthUrls {
  token_url?: string;
  revocation_url?: string;
  userinfo_url?: string;
}

export interface OAuthConnectStartInput {
  provider: string;
  redirect_uri: string;
  scope?: string;
  scopes?: string[];
  state?: string;
  external_user_id?: string;
  connection_storage?: OAuthConnectionStorage;
  appId?: string;
}

export interface OAuthConnectStartResponse {
  ok: true;
  authorization_url: string;
}

export interface OAuthExchangeInput {
  code: string;
  connection_id: string;
}

export interface OAuthExchangeResponse {
  ok: true;
  connection: OAuthSanitizedConnection;
  oauth?: OAuthUrls;
  access_token?: string;
  refresh_token?: string;
  token_type?: string;
  expires_at?: string;
}

export interface OAuthConnectionResponse {
  ok: true;
  connection: OAuthSanitizedConnection;
}

export interface OAuthTokenResponse {
  ok: true;
  access_token?: string;
  refresh_token?: string;
  token_type?: string;
  expires_at?: string;
}

export interface OAuthConnectionWithTokenResponse {
  ok: true;
  connection: OAuthSanitizedConnection;
  access_token?: string;
  refresh_token?: string;
  token_type?: string;
  expires_at?: string;
}

export interface OAuthRevokeInput {
  reason?: string;
}

export interface OAuthRevokeResponse {
  ok: true;
  revoked: true;
}

export interface OAuthDeleteResponse {
  ok: true;
  deleted: true;
}

export interface OAuthConnectApi {
  start(input: OAuthConnectStartInput): Promise<OAuthConnectStartResponse>;
  buildUrl(input: OAuthConnectStartInput): string;
}

export interface OAuthConnectionsApi {
  get(connectionId: string): Promise<OAuthConnectionResponse>;
  getToken(connectionId: string): Promise<OAuthTokenResponse>;
  sync(connectionId: string): Promise<OAuthTokenResponse>;
  refresh(connectionId: string): Promise<OAuthConnectionWithTokenResponse>;
  revoke(connectionId: string, input?: OAuthRevokeInput): Promise<OAuthRevokeResponse>;
  delete(connectionId: string): Promise<OAuthDeleteResponse>;
}

export interface OAuthAppClientApi {
  connect: OAuthConnectApi;
  exchange(input: OAuthExchangeInput): Promise<OAuthExchangeResponse>;
  connections: OAuthConnectionsApi;
}

export interface OAuthAppRegenerateCredentialsResponse {
  ok: true;
  app_secret: string;
  app_api_key: string;
}
