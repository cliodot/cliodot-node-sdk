export type AuthAppClientConfig = {
  baseUrl: string;
  appId: string;
  appApiKey?: string;
  appSecret?: string;
  debug?: boolean;
};

export type AuthMfaStatusResponse = {
  ok: true;
  external_user_id: string;
  mfa_enabled: boolean;
  factors: Array<{
    factor_type: string;
    status: string;
    activated_at?: string;
    recovery_codes_remaining: number;
  }>;
};

export type AuthTotpEnrollResponse = {
  ok: true;
  enrollment_id: string;
  status: string;
  factor_type: string;
  secret: string;
  otpauth_url: string;
  qr_code_data_url: string;
  pending_expires_at: string;
};

export type AuthTotpVerifyResponse = {
  ok: true;
  verified: boolean;
  method: string;
  enrollment_status: string;
  verified_at?: string;
  recovery_codes_remaining?: number;
  failure_reason?: string;
};

export type AuthRecoveryCodesResponse = {
  ok: true;
  codes: string[];
  batch_id: string;
  count: number;
};

export type AuthUpsertUserInput = {
  email?: string;
  display_name?: string;
  metadata?: Record<string, unknown>;
};

export type AuthMfaApi = {
  status(externalUserId: string): Promise<AuthMfaStatusResponse>;
  totp: {
    enroll(
      externalUserId: string,
      input?: { label?: string; reset?: boolean }
    ): Promise<AuthTotpEnrollResponse>;
    confirm(externalUserId: string, code: string): Promise<AuthTotpVerifyResponse>;
    verify(externalUserId: string, code: string): Promise<AuthTotpVerifyResponse>;
    disable(externalUserId: string): Promise<{ ok: true; disabled: boolean }>;
    reset(
      externalUserId: string,
      input?: { label?: string }
    ): Promise<AuthTotpEnrollResponse>;
  };
  recoveryCodes: {
    generate(externalUserId: string): Promise<AuthRecoveryCodesResponse>;
    verify(externalUserId: string, code: string): Promise<AuthTotpVerifyResponse>;
  };
};

export type AuthUsersApi = {
  upsert(externalUserId: string, input?: AuthUpsertUserInput): Promise<{ ok: true; user: Record<string, unknown> }>;
};

export type AuthAppClientApi = {
  users: AuthUsersApi;
  mfa: AuthMfaApi;
};
