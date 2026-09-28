import axios, { AxiosInstance } from "axios";
import { CliodotApiError, cliodotApiErrorFromAxios } from "./errors";
import { parseApiErrorCode, parseApiErrorMessage } from "./http/parse-api-error";
import { applyEnvironmentHeader } from "./http/cliodot-request";
import type {
  CommercialAnalyticsParams,
  CommercialAppClientApi,
  CommercialAppClientConfig,
  CommercialChangePlanInput,
  CommercialConfirmPaymentInput,
  CommercialCheckInput,
  CommercialCreateCustomerInput,
  CommercialCreateSubscriptionInput,
  CommercialInitiatePaymentInput,
  CommercialInitiatePaymentResult,
  CommercialConfirmPaymentResult,
  CommercialPaymentMethodSummary,
  CommercialCheckResult,
  CommercialConsumeInput,
  CommercialConsumeResult,
  CommercialCustomer,
  CommercialFeature,
  CommercialLicenseIssueInput,
  CommercialLicenseValidateInput,
  CommercialListCustomersResponse,
  CommercialListFeaturesResponse,
  CommercialListParams,
  CommercialListPlansResponse,
  CommercialInvoice,
  CommercialListInvoicesParams,
  CommercialListInvoicesResponse,
  CommercialListSubscriptionsParams,
  CommercialListSubscriptionsResponse,
  CommercialPaginationMeta,
  CommercialPlan,
  CommercialPricingQuote,
  CommercialPricingQuoteInput,
  CommercialSeatAssignInput,
  CommercialStateInput,
  CommercialStateResult,
  CommercialSubscription,
  CommercialUpdatePendingSubscriptionInput,
  CommercialUpdateSubscriptionStatusInput,
  CommercialEntitlementTopupInput,
  CommercialCreditsTopupInput,
  CommercialChargeUsageInput,
  CommercialChargeUsageResult,
  CommercialRenewSubscriptionInput,
  CommercialRenewSubscriptionResult,
  CommercialListCreditsParams,
  CommercialListCreditsResponse,
  CommercialAddCardInput,
  CommercialCustomerCard,
  CommercialListCardsParams,
  CommercialListCardsResponse,
  CommercialListEventsParams,
  CommercialListEventsResponse,
  CommercialListUsageEventsResponse,
  CommercialDiscount,
  CommercialTaxRate,
  CommercialAddon,
  CommercialSeatAssignment,
  CommercialLicense,
} from "./types/commercial-app.api";

function trimBaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

function resolveIdRef(
  value: unknown,
  keys: string[] = ["_id", "id"]
): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    for (const key of keys) {
      const candidate = obj[key];
      if (typeof candidate === "string" && candidate.trim()) {
        return candidate.trim();
      }
      if (typeof candidate === "number" && Number.isFinite(candidate)) {
        return String(candidate);
      }
    }
  }
  return "";
}

function cleanParams(
  params?: Record<string, unknown>
): Record<string, string | number | boolean> | undefined {
  if (!params) return undefined;
  const out: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      out[key] = value.join(",");
      continue;
    }
    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      out[key] = value;
    }
  }
  return Object.keys(out).length ? out : undefined;
}

export class CommercialAppClient implements CommercialAppClientApi {
  private readonly baseUrl: string;
  private readonly appId: string;
  private readonly apiKey?: string;
  private readonly appSecret?: string;
  private readonly environment?: string;
  private readonly axios: AxiosInstance;
  public readonly debug: boolean;

  constructor(config: CommercialAppClientConfig) {
    if (!config.baseUrl?.trim()) {
      throw new CliodotApiError("CommercialAppClient requires baseUrl");
    }
    if (!config.appId?.trim()) {
      throw new CliodotApiError("CommercialAppClient requires appId");
    }
    this.baseUrl = trimBaseUrl(config.baseUrl);
    this.appId = config.appId.trim();
    this.apiKey =
      config.apiKey?.trim() || config.appApiKey?.trim() || undefined;
    this.appSecret = config.appSecret?.trim() || undefined;
    this.environment = config.environment;
    this.debug = config.debug ?? false;
    this.axios = axios.create({
      baseURL: `${this.baseUrl}/commercial`,
      timeout: 60000,
      headers: { "Content-Type": "application/json" },
    });
  }

  check(input: CommercialCheckInput): Promise<CommercialCheckResult> {
    if (!input?.customer?.trim() || !input?.feature?.trim()) {
      throw new CliodotApiError("customer and feature are required");
    }
    return this.request("POST", "/v1/check", {
      body: {
        customer: input.customer.trim(),
        feature: input.feature.trim(),
        quantity: input.quantity,
      },
    });
  }

  consume(input: CommercialConsumeInput): Promise<CommercialConsumeResult> {
    if (!input?.customer?.trim() || !input?.feature?.trim()) {
      throw new CliodotApiError("customer and feature are required");
    }
    return this.request("POST", "/v1/consume", {
      body: {
        customer: input.customer.trim(),
        feature: input.feature.trim(),
        quantity: input.quantity,
      },
    });
  }

  state(input: CommercialStateInput): Promise<CommercialStateResult> {
    if (!input?.customer?.trim()) {
      throw new CliodotApiError("customer is required");
    }
    return this.request("GET", "/v1/state", {
      params: {
        customer: input.customer.trim(),
        include_billing: input.include_billing ? "true" : undefined,
      },
    });
  }

  getCustomerSubscription(
    customerId: string,
    options?: { include_billing?: boolean }
  ): Promise<CommercialStateResult> {
    if (!customerId?.trim()) {
      throw new CliodotApiError("customerId is required");
    }
    return this.request(
      "GET",
      `/v1/customers/${encodeURIComponent(customerId.trim())}/subscription`,
      {
        params: {
          include_billing: options?.include_billing ? "true" : undefined,
        },
      }
    );
  }

  listCustomers(
    params?: CommercialListParams
  ): Promise<CommercialListCustomersResponse> {
    return this.request("GET", "/v1/customers", {
      params: cleanParams(params as Record<string, unknown>),
    });
  }

  getCustomer(
    customerId: string
  ): Promise<{ ok: true; customer: CommercialCustomer }> {
    if (!customerId?.trim()) {
      throw new CliodotApiError("customerId is required");
    }
    return this.request("GET", `/v1/customers/${encodeURIComponent(customerId.trim())}`);
  }

  listCredits(
    customerId: string,
    params?: CommercialListCreditsParams
  ): Promise<CommercialListCreditsResponse> {
    if (!customerId?.trim()) {
      throw new CliodotApiError("customerId is required");
    }
    return this.request(
      "GET",
      `/v1/customers/${encodeURIComponent(customerId.trim())}/credits`,
      { params: cleanParams(params as Record<string, unknown>) }
    );
  }

  topupCredits(
    input: CommercialCreditsTopupInput
  ): Promise<{ ok: true; invoice: CommercialInvoice }> {
    if (!input?.customerId?.trim() || !input?.currency?.trim()) {
      throw new CliodotApiError("customerId and currency are required");
    }
    if (!Number.isFinite(input.amount) || input.amount <= 0) {
      throw new CliodotApiError("amount must be a positive number");
    }
    return this.request(
      "POST",
      `/v1/customers/${encodeURIComponent(input.customerId.trim())}/credits/topup`,
      {
        body: {
          currency: input.currency.trim(),
          amount: input.amount,
          payment_method: input.payment_method,
          card: input.card,
          card_id: input.card_id,
          payment_input: input.payment_input,
        },
      }
    );
  }

  listCards(
    customerId: string,
    params?: CommercialListCardsParams
  ): Promise<CommercialListCardsResponse> {
    if (!customerId?.trim()) {
      throw new CliodotApiError("customerId is required");
    }
    return this.request(
      "GET",
      `/v1/customers/${encodeURIComponent(customerId.trim())}/cards`,
      { params: cleanParams(params as Record<string, unknown>) }
    );
  }

  addCard(
    customerId: string,
    input: CommercialAddCardInput = {}
  ): Promise<{ ok: true; card: CommercialCustomerCard }> {
    if (!customerId?.trim()) {
      throw new CliodotApiError("customerId is required");
    }
    return this.request(
      "POST",
      `/v1/customers/${encodeURIComponent(customerId.trim())}/cards`,
      { body: input }
    );
  }

  updateCard(
    customerId: string,
    cardId: string,
    input: CommercialAddCardInput = {}
  ): Promise<{ ok: true; card: CommercialCustomerCard }> {
    if (!customerId?.trim() || !cardId?.trim()) {
      throw new CliodotApiError("customerId and cardId are required");
    }
    return this.request(
      "PATCH",
      `/v1/customers/${encodeURIComponent(customerId.trim())}/cards/${encodeURIComponent(cardId.trim())}`,
      { body: input }
    );
  }

  removeCard(
    customerId: string,
    cardId: string
  ): Promise<{ ok: true; card: CommercialCustomerCard }> {
    if (!customerId?.trim() || !cardId?.trim()) {
      throw new CliodotApiError("customerId and cardId are required");
    }
    return this.request(
      "DELETE",
      `/v1/customers/${encodeURIComponent(customerId.trim())}/cards/${encodeURIComponent(cardId.trim())}`
    );
  }

  setDefaultCard(
    customerId: string,
    cardId: string
  ): Promise<{ ok: true; card: CommercialCustomerCard }> {
    if (!customerId?.trim() || !cardId?.trim()) {
      throw new CliodotApiError("customerId and cardId are required");
    }
    return this.request(
      "POST",
      `/v1/customers/${encodeURIComponent(customerId.trim())}/cards/${encodeURIComponent(cardId.trim())}/default`
    );
  }

  createCustomer(
    input: CommercialCreateCustomerInput
  ): Promise<{ ok: true; customer: CommercialCustomer }> {
    if (!input?.customer_key?.trim() || !input?.name?.trim()) {
      throw new CliodotApiError("customer_key and name are required");
    }
    return this.request("POST", "/v1/customers", {
      body: {
        customer_key: input.customer_key.trim(),
        name: input.name.trim(),
        email: input.email,
        preferred_currency: input.preferred_currency,
        tax_ids: input.tax_ids,
        billing_address: input.billing_address,
        metadata: input.metadata,
      },
    });
  }

  listFeatures(
    params?: CommercialListParams
  ): Promise<CommercialListFeaturesResponse> {
    return this.request("GET", "/v1/features", {
      params: cleanParams(params as Record<string, unknown>),
    });
  }

  getFeature(
    featureId: string
  ): Promise<{ ok: true; feature: CommercialFeature }> {
    if (!featureId?.trim()) {
      throw new CliodotApiError("featureId is required");
    }
    return this.request(
      "GET",
      `/v1/features/${encodeURIComponent(featureId.trim())}`
    );
  }

  listPlans(params?: CommercialListParams): Promise<CommercialListPlansResponse> {
    return this.request("GET", "/v1/plans", {
      params: cleanParams(params as Record<string, unknown>),
    });
  }

  getPlan(planId: string): Promise<{ ok: true; plan: CommercialPlan }> {
    if (!planId?.trim()) {
      throw new CliodotApiError("planId is required");
    }
    return this.request("GET", `/v1/plans/${encodeURIComponent(planId.trim())}`);
  }

  listSubscriptions(
    params?: CommercialListSubscriptionsParams
  ): Promise<CommercialListSubscriptionsResponse> {
    return this.request("GET", "/v1/subscriptions", {
      params: cleanParams(params as Record<string, unknown>),
    });
  }

  getSubscription(
    subscriptionId: string
  ): Promise<{ ok: true; subscription: CommercialSubscription }> {
    if (!subscriptionId?.trim()) {
      throw new CliodotApiError("subscriptionId is required");
    }
    return this.request(
      "GET",
      `/v1/subscriptions/${encodeURIComponent(subscriptionId.trim())}`
    );
  }

  listInvoices(
    params?: CommercialListInvoicesParams
  ): Promise<CommercialListInvoicesResponse> {
    return this.request("GET", "/v1/invoices", {
      params: cleanParams(params as Record<string, unknown>),
    });
  }

  getInvoice(
    invoiceId:
      | string
      | {
          invoiceId?: string;
          _id?: string;
          id?: string;
          reference?: string;
        }
  ): Promise<{ ok: true; invoice: CommercialInvoice }> {
    const id = resolveIdRef(invoiceId, [
      "invoiceId",
      "_id",
      "id",
      "reference",
    ]);
    if (!id) {
      throw new CliodotApiError("invoiceId is required");
    }
    return this.request(
      "GET",
      `/v1/invoices/${encodeURIComponent(id)}`
    );
  }

  createSubscription(
    input: CommercialCreateSubscriptionInput
  ): Promise<{ ok: true; subscription: CommercialSubscription }> {
    if (!input?.customer?.trim() || !input?.plan?.trim()) {
      throw new CliodotApiError("customer and plan are required");
    }
    return this.request("POST", "/v1/subscriptions", {
      body: {
        customer: input.customer.trim(),
        plan: input.plan.trim(),
        status: input.status,
        currency: input.currency,
        discount_code: input.discount_code,
        tax_rate: input.tax_rate,
        addons: input.addons,
        seats_purchased: input.seats_purchased,
        metadata: input.metadata,
        payment_method: input.payment_method,
        card: input.card,
        card_id: input.card_id,
        payment_input: input.payment_input,
        auto_renew: input.auto_renew,
        renewal_mode: input.renewal_mode,
        skip_trial: input.skip_trial,
        usage_rollover: input.usage_rollover,
      },
    });
  }

  subscribe(
    input: CommercialCreateSubscriptionInput
  ): Promise<{ ok: true; subscription: CommercialSubscription }> {
    return this.createSubscription(input);
  }

  updatePendingSubscription(
    input: CommercialUpdatePendingSubscriptionInput
  ): Promise<{ ok: true; subscription: CommercialSubscription }> {
    if (!input?.subscriptionId?.trim()) {
      throw new CliodotApiError("subscriptionId is required");
    }
    return this.request(
      "PATCH",
      `/v1/subscriptions/${encodeURIComponent(input.subscriptionId.trim())}`,
      {
        body: {
          plan: input.plan,
          currency: input.currency,
          discount_code: input.discount_code,
          tax_rate: input.tax_rate,
          addons: input.addons,
          seats_purchased: input.seats_purchased,
          payment_method: input.payment_method,
          card: input.card,
          card_id: input.card_id,
          payment_input: input.payment_input,
          auto_renew: input.auto_renew,
          renewal_mode: input.renewal_mode,
          skip_trial: input.skip_trial,
          metadata: input.metadata,
        },
      }
    );
  }

  changePlan(
    input: CommercialChangePlanInput
  ): Promise<{ ok: true; subscription: CommercialSubscription }> {
    if (!input?.subscriptionId?.trim() || !input?.plan?.trim()) {
      throw new CliodotApiError("subscriptionId and plan are required");
    }
    return this.request(
      "POST",
      `/v1/subscriptions/${encodeURIComponent(input.subscriptionId.trim())}/change-plan`,
      {
        body: {
          plan: input.plan.trim(),
          currency: input.currency,
          discount_code: input.discount_code,
          tax_rate: input.tax_rate,
          addons: input.addons,
          seats_purchased: input.seats_purchased,
          payment_method: input.payment_method,
          card: input.card,
          card_id: input.card_id,
          payment_input: input.payment_input,
          auto_renew: input.auto_renew,
          renewal_mode: input.renewal_mode,
          apply_at: input.apply_at,
          usage_rollover: input.usage_rollover,
        },
      }
    );
  }

  entitlementTopup(
    input: CommercialEntitlementTopupInput
  ): Promise<{
    ok: true;
    invoice: CommercialInvoice;
    subscription: CommercialSubscription;
  }> {
    if (!input?.subscriptionId?.trim() || !input?.feature?.trim()) {
      throw new CliodotApiError("subscriptionId and feature are required");
    }
    return this.request(
      "POST",
      `/v1/subscriptions/${encodeURIComponent(input.subscriptionId.trim())}/entitlement-topup`,
      {
        body: {
          feature: input.feature.trim(),
          pack_units: input.pack_units,
          pack_index: input.pack_index,
          payment_method: input.payment_method,
          card: input.card,
          card_id: input.card_id,
          payment_input: input.payment_input,
        },
      }
    );
  }

  chargeUsage(
    input: CommercialChargeUsageInput
  ): Promise<CommercialChargeUsageResult> {
    if (!input?.subscriptionId?.trim()) {
      throw new CliodotApiError("subscriptionId is required");
    }
    return this.request(
      "POST",
      `/v1/subscriptions/${encodeURIComponent(input.subscriptionId.trim())}/charge-usage`,
      {
        body: {
          amount: input.amount,
          payment_method: input.payment_method,
          card: input.card,
          card_id: input.card_id,
          payment_input: input.payment_input,
        },
      }
    );
  }

  renewSubscription(
    input: CommercialRenewSubscriptionInput
  ): Promise<CommercialRenewSubscriptionResult> {
    if (!input?.subscriptionId?.trim()) {
      throw new CliodotApiError("subscriptionId is required");
    }
    return this.request(
      "POST",
      `/v1/subscriptions/${encodeURIComponent(input.subscriptionId.trim())}/renew`,
      {
        body: {
          payment_method: input.payment_method,
        },
      }
    );
  }

  renew(
    input: CommercialRenewSubscriptionInput
  ): Promise<CommercialRenewSubscriptionResult> {
    return this.renewSubscription(input);
  }

  listEvents(
    customerId: string,
    params?: CommercialListEventsParams
  ): Promise<CommercialListEventsResponse> {
    if (!customerId?.trim()) {
      throw new CliodotApiError("customerId is required");
    }
    return this.request(
      "GET",
      `/v1/customers/${encodeURIComponent(customerId.trim())}/events`,
      { params: cleanParams(params as Record<string, unknown>) }
    );
  }

  listUsageEvents(
    customerId: string,
    params?: CommercialListEventsParams
  ): Promise<CommercialListUsageEventsResponse> {
    if (!customerId?.trim()) {
      throw new CliodotApiError("customerId is required");
    }
    return this.request(
      "GET",
      `/v1/customers/${encodeURIComponent(customerId.trim())}/usage-events`,
      { params: cleanParams(params as Record<string, unknown>) }
    );
  }

  listEventTypes(): Promise<{ ok: true; event_types: string[] }> {
    return this.request("GET", "/v1/event-types");
  }

  listPaymentMethods(): Promise<{
    ok: true;
    payment_methods: CommercialPaymentMethodSummary[];
  }> {
    return this.request("GET", "/v1/payment-methods");
  }

  initiatePayment(
    input: CommercialInitiatePaymentInput
  ): Promise<CommercialInitiatePaymentResult> {
    if (!input?.customer?.trim()) {
      throw new CliodotApiError("customer is required");
    }
    return this.request("POST", "/v1/payments/initiate", {
      body: {
        customer: input.customer.trim(),
        subscription: input.subscription,
        invoice: input.invoice,
        payment_method: input.payment_method,
        card: input.card,
        card_id: input.card_id,
        input: input.input,
        currency: input.currency,
        discount_code: input.discount_code,
      },
    });
  }

  confirmPayment(
    input: CommercialConfirmPaymentInput
  ): Promise<CommercialConfirmPaymentResult> {
    if (!input?.reference?.trim() || !input?.status?.trim()) {
      throw new CliodotApiError("reference and status are required");
    }
    return this.request("POST", "/v1/payments/confirm", {
      body: {
        reference: input.reference.trim(),
        status: input.status,
        provider_payment_id: input.provider_payment_id,
        failure_reason: input.failure_reason,
        metadata: input.metadata,
      },
    });
  }

  quote(
    input: CommercialPricingQuoteInput
  ): Promise<{ ok: true; quote: CommercialPricingQuote }> {
    if (!input?.plan?.trim()) {
      throw new CliodotApiError("plan is required");
    }
    return this.request("POST", "/v1/pricing/quote", {
      body: {
        plan: input.plan.trim(),
        customer: input.customer,
        currency: input.currency,
        discount_code: input.discount_code,
        tax_rate: input.tax_rate,
        addons: input.addons,
        seats_purchased: input.seats_purchased,
        metadata: input.metadata,
      },
    });
  }

  previewDiscount(input: {
    code: string;
    plan: string;
    currency?: string;
    customer?: string;
  }): Promise<{ ok: true; discount: CommercialDiscount; quote: CommercialPricingQuote }> {
    if (!input?.code?.trim() || !input?.plan?.trim()) {
      throw new CliodotApiError("code and plan are required");
    }
    return this.request("POST", "/v1/discounts/preview", {
      body: {
        code: input.code.trim(),
        plan: input.plan.trim(),
        currency: input.currency,
        customer: input.customer,
      },
    });
  }

  listDiscounts(
    params?: CommercialListParams
  ): Promise<{ ok: true; discounts: CommercialDiscount[]; pagination: CommercialPaginationMeta }> {
    return this.request("GET", "/v1/discounts", {
      params: cleanParams(params as Record<string, unknown>),
    });
  }

  listTaxRates(
    params?: CommercialListParams
  ): Promise<{ ok: true; tax_rates: CommercialTaxRate[]; pagination: CommercialPaginationMeta }> {
    return this.request("GET", "/v1/tax-rates", {
      params: cleanParams(params as Record<string, unknown>),
    });
  }

  listAddons(
    params?: CommercialListParams
  ): Promise<{ ok: true; addons: CommercialAddon[]; pagination: CommercialPaginationMeta }> {
    return this.request("GET", "/v1/addons", {
      params: cleanParams(params as Record<string, unknown>),
    });
  }

  updateSubscriptionStatus(
    input: CommercialUpdateSubscriptionStatusInput
  ): Promise<{ ok: true; subscription: CommercialSubscription }> {
    if (!input?.subscriptionId?.trim() || !input?.status?.trim()) {
      throw new CliodotApiError("subscriptionId and status are required");
    }
    return this.request(
      "PATCH",
      `/v1/subscriptions/${encodeURIComponent(input.subscriptionId.trim())}/status`,
      { body: { status: input.status.trim() } }
    );
  }

  archiveSubscription(
    subscriptionId: string
  ): Promise<{ ok: true; subscription: CommercialSubscription }> {
    if (!subscriptionId?.trim()) {
      throw new CliodotApiError("subscriptionId is required");
    }
    return this.request(
      "POST",
      `/v1/subscriptions/${encodeURIComponent(subscriptionId.trim())}/archive`
    );
  }

  assignSeat(
    input: CommercialSeatAssignInput
  ): Promise<{ ok: true; assignment: CommercialSeatAssignment }> {
    if (!input?.customer?.trim() || !input?.subject_key?.trim()) {
      throw new CliodotApiError("customer and subject_key are required");
    }
    return this.request("POST", "/v1/seats/assign", {
      body: {
        customer: input.customer.trim(),
        subject_key: input.subject_key.trim(),
        email: input.email,
        metadata: input.metadata,
      },
    });
  }

  unassignSeat(input: CommercialSeatAssignInput): Promise<{ ok: boolean }> {
    if (!input?.customer?.trim() || !input?.subject_key?.trim()) {
      throw new CliodotApiError("customer and subject_key are required");
    }
    return this.request("POST", "/v1/seats/unassign", {
      body: {
        customer: input.customer.trim(),
        subject_key: input.subject_key.trim(),
        email: input.email,
        metadata: input.metadata,
      },
    });
  }

  issueLicense(
    input: CommercialLicenseIssueInput
  ): Promise<{ ok: true; license: CommercialLicense; license_key: string }> {
    if (!input?.customer?.trim()) {
      throw new CliodotApiError("customer is required");
    }
    return this.request("POST", "/v1/licenses/issue", {
      body: {
        customer: input.customer.trim(),
        expires_at: input.expires_at,
        metadata: input.metadata,
      },
    });
  }

  validateLicense(
    input: CommercialLicenseValidateInput
  ): Promise<{ ok: true; valid: boolean; [key: string]: unknown }> {
    if (!input?.license_key?.trim()) {
      throw new CliodotApiError("license_key is required");
    }
    return this.request("POST", "/v1/licenses/validate", {
      body: { license_key: input.license_key.trim() },
    });
  }

  revokeLicense(licenseId: string): Promise<{ ok: true; license: CommercialLicense }> {
    if (!licenseId?.trim()) {
      throw new CliodotApiError("licenseId is required");
    }
    return this.request(
      "POST",
      `/v1/licenses/${encodeURIComponent(licenseId.trim())}/revoke`
    );
  }

  analytics(
    params?: CommercialAnalyticsParams
  ): Promise<{ ok: true; analytics: unknown }> {
    return this.request("GET", "/v1/analytics", {
      params: cleanParams(params as Record<string, unknown>),
    });
  }

  analyticsCharts(
    params?: CommercialAnalyticsParams
  ): Promise<{ ok: true; [key: string]: unknown }> {
    return this.request("GET", "/v1/analytics/charts", {
      params: cleanParams(params as Record<string, unknown>),
    });
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
      "CommercialAppClient credentials required (apiKey/appApiKey or appSecret)"
    );
  }

  private async request<T>(
    method: string,
    path: string,
    options?: {
      body?: Record<string, unknown>;
      params?: Record<string, string | number | boolean | undefined>;
    }
  ): Promise<T> {
    try {
      const { data } = await this.axios({
        method,
        url: path,
        headers: this.buildAuthHeaders(),
        data: options?.body,
        params: cleanParams(options?.params as Record<string, unknown>),
      });
      if (data?.ok === false) {
        throw new CliodotApiError(
          parseApiErrorMessage(data) || "Commercial request failed",
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
