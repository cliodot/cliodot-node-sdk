import axios, { AxiosInstance } from "axios";
import { CliodotApiError, cliodotApiErrorFromAxios } from "./errors";
import { parseApiErrorCode, parseApiErrorMessage } from "./http/parse-api-error";
import { applyEnvironmentHeader } from "./http/cliodot-request";
import type {
  AuthAppClientApi,
  AuthAppClientConfig,
  AuthMagicLinkProviderApi,
  AuthMagicLinkSendResponse,
  AuthMagicLinkVerifyResponse,
  AuthMfaApi,
  AuthOtpProviderApi,
  AuthOtpSendInput,
  AuthOtpSendResponse,
  AuthOtpStatusResponse,
  AuthOtpVerifyResponse,
  AuthProvidersApi,
  AuthRecoveryCodesResponse,
  AuthTotpEnrollResponse,
  AuthTotpVerifyResponse,
  AuthUpsertUserInput,
  AuthUsersApi,
} from "./types/auth-app.api";

function trimBaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

function assertExternalUserId(externalUserId: string): void {
  if (!externalUserId?.trim()) {
    throw new CliodotApiError("externalUserId is required");
  }
}

function assertCode(code: string): void {
  if (!code?.trim()) {
    throw new CliodotApiError("code is required");
  }
}

function assertToken(token: string): void {
  if (!token?.trim()) {
    throw new CliodotApiError("token is required");
  }
}

export class AuthAppClient implements AuthAppClientApi {
  private readonly baseUrl: string;
  private readonly appId: string;
  private readonly appApiKey?: string;
  private readonly appSecret?: string;
  private readonly environment?: string;
  private readonly axios: AxiosInstance;
  public readonly debug: boolean;

  public readonly users: AuthUsersApi;
  public readonly mfa: AuthMfaApi;
  public readonly providers: AuthProvidersApi;

  constructor(config: AuthAppClientConfig) {
    if (!config.baseUrl?.trim()) {
      throw new CliodotApiError("AuthAppClient requires baseUrl");
    }
    if (!config.appId?.trim()) {
      throw new CliodotApiError("AuthAppClient requires appId");
    }
    this.baseUrl = trimBaseUrl(config.baseUrl);
    this.appId = config.appId.trim();
    this.appApiKey = config.appApiKey?.trim() || undefined;
    this.appSecret = config.appSecret?.trim() || undefined;
    this.environment = config.environment;
    this.debug = config.debug ?? false;
    this.axios = axios.create({
      baseURL: `${this.baseUrl}/auth`,
      timeout: 30000,
      headers: { "Content-Type": "application/json" },
    });

    this.users = {
      upsert: (externalUserId, input) => this.upsertUser(externalUserId, input),
    };

    this.mfa = {
      status: (externalUserId) => this.mfaStatus(externalUserId),
      totp: {
        enroll: (externalUserId, input) => this.totpEnroll(externalUserId, input),
        confirm: (externalUserId, code) => this.totpConfirm(externalUserId, code),
        verify: (externalUserId, code) => this.totpVerify(externalUserId, code),
        disable: (externalUserId) => this.totpDisable(externalUserId),
        reset: (externalUserId, input) => this.totpReset(externalUserId, input),
      },
      recoveryCodes: {
        generate: (externalUserId) => this.generateRecoveryCodes(externalUserId),
        verify: (externalUserId, code) => this.verifyRecoveryCode(externalUserId, code),
      },
    };

    this.providers = {
      emailOtp: this.createOtpProvider("email_otp"),
      smsOtp: this.createOtpProvider("sms_otp"),
      magicLink: this.createMagicLinkProvider(),
    };
  }

  private createMagicLinkProvider(): AuthMagicLinkProviderApi {
    const base = (externalUserId: string) =>
      `${this.userPath(externalUserId)}/providers/magic_link`;

    return {
      enroll: (externalUserId, input) =>
        this.request<AuthMagicLinkSendResponse>("POST", `${base(externalUserId)}/enroll`, input),
      challenge: (externalUserId, input) =>
        this.request<AuthMagicLinkSendResponse>("POST", `${base(externalUserId)}/challenge`, input),
      resend: (externalUserId, input) =>
        this.request<AuthMagicLinkSendResponse>("POST", `${base(externalUserId)}/resend`, input),
      verify: (externalUserId, token) => {
        assertToken(token);
        return this.request<AuthMagicLinkVerifyResponse>("POST", `${base(externalUserId)}/verify`, {
          token,
        });
      },
      verifyPublic: (token) => {
        assertToken(token);
        return this.verifyMagicLinkPublic(token);
      },
      disable: (externalUserId) =>
        this.request<{ ok: true; disabled: true }>("POST", `${base(externalUserId)}/disable`),
      status: (externalUserId) =>
        this.request<AuthOtpStatusResponse>("GET", `${base(externalUserId)}/status`),
    };
  }

  private async verifyMagicLinkPublic(token: string): Promise<AuthMagicLinkVerifyResponse> {
    try {
      const { data } = await this.axios({
        method: "POST",
        url: `/apps/${encodeURIComponent(this.appId)}/magic-link/verify`,
        data: { token },
      });
      if (data?.ok === false) {
        throw new CliodotApiError(parseApiErrorMessage(data) || "Auth request failed", {
          data,
          code: parseApiErrorCode(data),
        });
      }
      return data;
    } catch (err: any) {
      if (err instanceof CliodotApiError) {
        throw err;
      }
      throw cliodotApiErrorFromAxios(err, "Request failed: POST magic-link/verify");
    }
  }

  private createOtpProvider(provider: "email_otp" | "sms_otp"): AuthOtpProviderApi {
    const base = (externalUserId: string) =>
      `${this.userPath(externalUserId)}/providers/${provider}`;

    return {
      enroll: (externalUserId, input) =>
        this.request<AuthOtpSendResponse>("POST", `${base(externalUserId)}/enroll`, input),
      challenge: (externalUserId, input) =>
        this.request<AuthOtpSendResponse>("POST", `${base(externalUserId)}/challenge`, input),
      resend: (externalUserId, input) =>
        this.request<AuthOtpSendResponse>("POST", `${base(externalUserId)}/resend`, input),
      verify: (externalUserId, code) => {
        assertCode(code);
        return this.request<AuthOtpVerifyResponse>("POST", `${base(externalUserId)}/verify`, {
          code,
        });
      },
      disable: (externalUserId) =>
        this.request<{ ok: true; disabled: true }>("POST", `${base(externalUserId)}/disable`),
      status: (externalUserId) =>
        this.request<AuthOtpStatusResponse>("GET", `${base(externalUserId)}/status`),
    };
  }

  private buildS2SHeaders(): Record<string, string> {
    if (this.appApiKey) {
      return applyEnvironmentHeader(
        { Authorization: `Bearer ${this.appApiKey}` },
        this.environment
      );
    }
    if (this.appSecret) {
      return applyEnvironmentHeader(
        {
          "X-Cliodot-App-Id": this.appId,
          "X-Cliodot-App-Secret": this.appSecret,
        },
        this.environment
      );
    }
    throw new CliodotApiError("Auth app credentials required (appApiKey or appSecret)");
  }

  private userPath(externalUserId: string): string {
    assertExternalUserId(externalUserId);
    return `/apps/${encodeURIComponent(this.appId)}/users/${encodeURIComponent(externalUserId.trim())}`;
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
        headers: this.buildS2SHeaders(),
        data: body,
      });
      if (data?.ok === false) {
        throw new CliodotApiError(parseApiErrorMessage(data) || "Auth request failed", {
          data,
          code: parseApiErrorCode(data),
        });
      }
      return data as T;
    } catch (err: any) {
      if (err instanceof CliodotApiError) {
        throw err;
      }
      throw cliodotApiErrorFromAxios(err, `Request failed: ${method} ${path}`);
    }
  }

  private upsertUser(externalUserId: string, input?: AuthUpsertUserInput) {
    return this.request<{ ok: true; user: Record<string, unknown> }>(
      "PUT",
      this.userPath(externalUserId),
      input
    );
  }

  private mfaStatus(externalUserId: string) {
    return this.request<import("./types/auth-app.api").AuthMfaStatusResponse>(
      "GET",
      `${this.userPath(externalUserId)}/mfa/status`
    );
  }

  private totpEnroll(
    externalUserId: string,
    input?: { label?: string; reset?: boolean }
  ): Promise<AuthTotpEnrollResponse> {
    return this.request<AuthTotpEnrollResponse>(
      "POST",
      `${this.userPath(externalUserId)}/mfa/totp/enroll`,
      input
    );
  }

  private totpConfirm(externalUserId: string, code: string): Promise<AuthTotpVerifyResponse> {
    assertCode(code);
    return this.request<AuthTotpVerifyResponse>(
      "POST",
      `${this.userPath(externalUserId)}/mfa/totp/confirm`,
      { code }
    );
  }

  private totpVerify(externalUserId: string, code: string): Promise<AuthTotpVerifyResponse> {
    assertCode(code);
    return this.request<AuthTotpVerifyResponse>(
      "POST",
      `${this.userPath(externalUserId)}/mfa/totp/verify`,
      { code }
    );
  }

  private totpDisable(externalUserId: string) {
    return this.request<{ ok: true; disabled: boolean }>(
      "POST",
      `${this.userPath(externalUserId)}/mfa/totp/disable`
    );
  }

  private totpReset(
    externalUserId: string,
    input?: { label?: string }
  ): Promise<AuthTotpEnrollResponse> {
    return this.request<AuthTotpEnrollResponse>(
      "POST",
      `${this.userPath(externalUserId)}/mfa/totp/reset`,
      input
    );
  }

  private generateRecoveryCodes(externalUserId: string): Promise<AuthRecoveryCodesResponse> {
    return this.request<AuthRecoveryCodesResponse>(
      "POST",
      `${this.userPath(externalUserId)}/mfa/recovery-codes`
    );
  }

  private verifyRecoveryCode(externalUserId: string, code: string): Promise<AuthTotpVerifyResponse> {
    assertCode(code);
    return this.request<AuthTotpVerifyResponse>(
      "POST",
      `${this.userPath(externalUserId)}/mfa/recovery-codes/verify`,
      { code }
    );
  }
}
