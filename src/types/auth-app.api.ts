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
  phone?: string;
  phone_country_code?: string;
  display_name?: string;
  metadata?: Record<string, unknown>;
};

export type AuthOtpSendInput = {
  email?: string;
  phone?: string;
  phone_country_code?: string;
  custom_subject?: string;
  custom_body?: string;
  cc?: string;
  bcc?: string;
  attachments?: Array<{
    filename?: string;
    content?: string;
    url?: string;
    content_type?: string;
  }>;
  meta?: Record<string, string>;
};

export type AuthOtpSendResponse = {
  ok: true;
  sent?: boolean;
  queued?: boolean;
  position?: number;
  scheduled_at?: string;
  expires_at?: string;
  challenge_id?: string;
};

export type AuthOtpVerifyResponse = {
  ok: true;
  verified: boolean;
  method: string;
  external_user_id?: string;
  enrollment_status?: string;
  verified_at?: string;
};

export type AuthOtpStatusResponse = {
  ok: true;
  external_user_id: string;
  factor_type: string;
  enrollment_status: string | null;
  mfa_enabled: boolean;
  destination_masked?: string;
};

export type AuthOtpProviderApi = {
  enroll(externalUserId: string, input?: AuthOtpSendInput): Promise<AuthOtpSendResponse>;
  challenge(externalUserId: string, input?: AuthOtpSendInput): Promise<AuthOtpSendResponse>;
  resend(externalUserId: string, input?: AuthOtpSendInput): Promise<AuthOtpSendResponse>;
  verify(externalUserId: string, code: string): Promise<AuthOtpVerifyResponse>;
  disable(externalUserId: string): Promise<{ ok: true; disabled: true }>;
  status(externalUserId: string): Promise<AuthOtpStatusResponse>;
};

export type AuthProvidersApi = {
  emailOtp: AuthOtpProviderApi;
  smsOtp: AuthOtpProviderApi;
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
  providers: AuthProvidersApi;
};
