export enum OAuthAppProtocol {
  OAUTH2 = "oauth2",
  OIDC = "oidc",
  SAML = "saml",
}

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

export const OAUTH_GRANT_TYPE_AUTHORIZATION_CODE = "authorization_code";
export const OAUTH_GRANT_TYPE_CLIENT_CREDENTIALS = "client_credentials";
export const OAUTH_GRANT_TYPE_DEVICE_CODE =
  "urn:ietf:params:oauth:grant-type:device_code";
export const OAUTH_GRANT_TYPE_JWT_BEARER =
  "urn:ietf:params:oauth:grant-type:jwt-bearer";
export const OAUTH_GRANT_TYPE_SAML2_BEARER =
  "urn:ietf:params:oauth:grant-type:saml2-bearer";
export const OAUTH_GRANT_TYPE_TOKEN_EXCHANGE =
  "urn:ietf:params:oauth:grant-type:token-exchange";

export type OAuthGrantType =
  | typeof OAUTH_GRANT_TYPE_AUTHORIZATION_CODE
  | typeof OAUTH_GRANT_TYPE_CLIENT_CREDENTIALS
  | typeof OAUTH_GRANT_TYPE_DEVICE_CODE
  | typeof OAUTH_GRANT_TYPE_JWT_BEARER
  | typeof OAUTH_GRANT_TYPE_SAML2_BEARER
  | typeof OAUTH_GRANT_TYPE_TOKEN_EXCHANGE
  | string;

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
  | "OAUTH_CONNECTION_EXPIRED"
  | "OAUTH_TEMPLATE_NOT_FOUND"
  | "OAUTH_TEMPLATE_INVALID"
  | "OAUTH_TEMPLATE_SLUG_EXISTS";

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
  raw_profile?: Record<string, unknown>;
}

export interface OAuthSanitizedConnection {
  id: string;
  oauth_app_id: string;
  provider: string;
  protocol?: OAuthAppProtocol;
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
  id_token?: string;
}

export interface OAuthSamlSessionFields {
  name_id?: string;
  session_index?: string;
  saml_attributes?: Record<string, unknown>;
  assertion_expires_at?: string;
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
  assertion?: string;
  subject_token?: string;
  subject_token_type?: string;
  requested_token_type?: string;
  actor_token?: string;
  actor_token_type?: string;
  audience?: string;
}

export interface OAuthConnectStartResponse {
  ok: true;
  protocol?: OAuthAppProtocol;
  grant_type?: OAuthGrantType;
  authorization_url?: string;
  sso_binding?: "redirect" | "post";
  saml_request?: string;
  relay_state?: string;
  device_code?: string;
  user_code?: string;
  verification_uri?: string;
  verification_uri_complete?: string;
  poll_interval?: number;
  expires_in?: number;
  poll_state?: string;
  exchange_code?: string;
  connection_id?: string;
  redirect_url?: string;
}

export interface OAuthConnectPollInput {
  provider: string;
  poll_state: string;
  appId?: string;
  pollIntervalMs?: number;
  maxAttempts?: number;
}

export interface OAuthConnectPollResponse {
  ok: true;
  protocol?: OAuthAppProtocol;
  grant_type?: OAuthGrantType;
  exchange_code?: string;
  connection_id?: string;
  redirect_url?: string;
}

export interface OAuthSamlPostForm {
  action: string;
  samlRequest: string;
  relayState: string;
}

export interface OAuthExchangeInput {
  code: string;
  connection_id: string;
}

export interface OAuthExchangeResponse {
  ok: true;
  protocol?: OAuthAppProtocol;
  connection: OAuthSanitizedConnection;
  oauth?: OAuthUrls;
  access_token?: string;
  refresh_token?: string;
  token_type?: string;
  expires_at?: string;
  scope?: string;
  id_token?: string;
  name_id?: string;
  saml_attributes?: Record<string, unknown>;
  assertion_expires_at?: string;
  provider_token_response?: Record<string, unknown>;
}

export interface OAuthConnectionResponse {
  ok: true;
  connection: OAuthSanitizedConnection;
}

export interface OAuthTokenResponse {
  ok: true;
  protocol?: OAuthAppProtocol;
  connection?: OAuthSanitizedConnection;
  access_token?: string;
  refresh_token?: string;
  token_type?: string;
  expires_at?: string;
  scope?: string;
  id_token?: string;
  name_id?: string;
  saml_attributes?: Record<string, unknown>;
  assertion_expires_at?: string;
  provider_token_response?: Record<string, unknown>;
  oauth?: OAuthUrls;
}

export interface OAuthConnectionWithTokenResponse {
  ok: true;
  protocol?: OAuthAppProtocol;
  connection: OAuthSanitizedConnection;
  access_token?: string;
  refresh_token?: string;
  token_type?: string;
  expires_at?: string;
  scope?: string;
  id_token?: string;
  name_id?: string;
  saml_attributes?: Record<string, unknown>;
  assertion_expires_at?: string;
  provider_token_response?: Record<string, unknown>;
  oauth?: OAuthUrls;
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
  poll(input: OAuthConnectPollInput): Promise<OAuthConnectPollResponse>;
  buildUrl(input: OAuthConnectStartInput): string;
  buildSamlPostForm(response: OAuthConnectStartResponse): OAuthSamlPostForm | null;
  isSamlPostBinding(response: OAuthConnectStartResponse): boolean;
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

export function isSamlProtocol(protocol?: OAuthAppProtocol): boolean {
  return protocol === OAuthAppProtocol.SAML;
}

export function isOidcProtocol(protocol?: OAuthAppProtocol): boolean {
  return protocol === OAuthAppProtocol.OIDC;
}

export function normalizeOAuthGrantType(grantType?: string): OAuthGrantType {
  const value = String(grantType ?? OAUTH_GRANT_TYPE_AUTHORIZATION_CODE)
    .trim()
    .toLowerCase();
  if (value === "device_code" || value === OAUTH_GRANT_TYPE_DEVICE_CODE) {
    return OAUTH_GRANT_TYPE_DEVICE_CODE;
  }
  if (value === "jwt-bearer" || value === "jwt_bearer" || value === OAUTH_GRANT_TYPE_JWT_BEARER) {
    return OAUTH_GRANT_TYPE_JWT_BEARER;
  }
  if (value === "saml2-bearer" || value === "saml2_bearer" || value === OAUTH_GRANT_TYPE_SAML2_BEARER) {
    return OAUTH_GRANT_TYPE_SAML2_BEARER;
  }
  if (value === "token-exchange" || value === "token_exchange" || value === OAUTH_GRANT_TYPE_TOKEN_EXCHANGE) {
    return OAUTH_GRANT_TYPE_TOKEN_EXCHANGE;
  }
  return value;
}

export function isBrowserAuthorizationResponse(
  response: OAuthConnectStartResponse
): boolean {
  return !!response.authorization_url;
}

export function isDeviceConnectResponse(
  response: OAuthConnectStartResponse
): boolean {
  return (
    normalizeOAuthGrantType(response.grant_type) === OAUTH_GRANT_TYPE_DEVICE_CODE &&
    !!response.poll_state &&
    !!response.device_code
  );
}

export function isImmediateConnectResponse(
  response: OAuthConnectStartResponse
): boolean {
  return !!response.exchange_code && !!response.connection_id;
}

export function isDeviceAuthorizationPendingError(err: unknown): boolean {
  if (!err || typeof err !== "object") {
    return false;
  }
  const status = (err as { status?: number }).status;
  const message = String((err as { message?: string }).message ?? "").toLowerCase();
  return (
    status === 428 ||
    message === "authorization_pending" ||
    message === "slow_down"
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function pollDeviceConnectWithBackoff(
  client: { connect: Pick<OAuthConnectApi, "poll"> },
  input: OAuthConnectPollInput
): Promise<OAuthConnectPollResponse> {
  const intervalMs = input.pollIntervalMs ?? 5000;
  const maxAttempts = input.maxAttempts ?? 120;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      return await client.connect.poll(input);
    } catch (err) {
      if (!isDeviceAuthorizationPendingError(err) || attempt === maxAttempts - 1) {
        throw err;
      }
      await sleep(intervalMs);
    }
  }

  throw new Error("Device authorization poll timed out");
}
