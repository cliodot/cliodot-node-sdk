export type CommercialAppClientConfig = {
  baseUrl: string;
  appId: string;
  apiKey?: string;
  appApiKey?: string;
  appSecret?: string;
  debug?: boolean;
};

export type CommercialPaginationMeta = {
  totalDocs: number;
  totalPages: number;
  page: number;
  limit: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
};

export type CommercialListParams = {
  page?: number;
  limit?: number;
  q?: string;
};

export type CommercialCustomer = {
  _id: string;
  tenant_id: string;
  app_id: string;
  customer_key: string;
  name?: string;
  email?: string;
  status: string;
  preferred_currency?: string;
  tax_ids?: Array<{ type: string; value: string }>;
  billing_address?: {
    country: string;
    region?: string;
    city?: string;
    line1?: string;
    postal_code?: string;
  };
  metadata?: Record<string, unknown>;
  createdAt?: string | Date;
  updatedAt?: string | Date;
};

export type CommercialCreateCustomerInput = {
  customer_key: string;
  name: string;
  email?: string;
  preferred_currency?: string;
  tax_ids?: Array<{ type: string; value: string }>;
  billing_address?: {
    country: string;
    region?: string;
    city?: string;
    line1?: string;
    postal_code?: string;
  };
  metadata?: Record<string, unknown>;
};

export type CommercialFeature = {
  _id: string;
  tenant_id: string;
  app_id: string;
  key: string;
  name: string;
  kind: "boolean" | "metered" | "limit" | string;
  unit?: string;
  default_increment?: number;
  description?: string;
};

export type CommercialPlanEntitlement = {
  feature_key: string;
  enabled: boolean;
  limit: number | null;
};

export type CommercialPrice = {
  currency: string;
  amount: number;
  active?: boolean;
  metadata?: Record<string, unknown>;
};

export type CommercialPlanInterval =
  | "daily"
  | "weekly"
  | "monthly"
  | "quarterly"
  | "biannual"
  | "yearly"
  | "custom"
  | "lifetime"
  | "none"
  | (string & {});

export type CommercialPlan = {
  _id: string;
  tenant_id: string;
  app_id: string;
  key: string;
  name: string;
  description?: string;
  currency?: string;
  amount?: number;
  prices?: CommercialPrice[];
  default_currency?: string;
  interval: CommercialPlanInterval;
  interval_days?: number;
  entitlements: CommercialPlanEntitlement[];
  trial_days?: number;
  allowed_addon_keys?: string[];
  metadata?: Record<string, unknown>;
};

export type CommercialSubscription = {
  _id: string;
  tenant_id: string;
  app_id: string;
  customer_id: string;
  plan_id: string;
  plan_key: string;
  plan_name: string;
  plan_interval: CommercialPlanInterval;
  plan_interval_days?: number;
  plan_entitlements: CommercialPlanEntitlement[];
  status: string;
  currency?: string;
  amount?: number;
  billing_interval?: CommercialPlanInterval;
  billing_interval_days?: number;
  discount?: Record<string, unknown> | null;
  tax_rate_id?: string;
  tax_percent?: number;
  addons?: Array<{
    addon_key: string;
    quantity: number;
    unit_amount: number;
    currency: string;
    metadata?: Record<string, unknown>;
  }>;
  seats_purchased?: number;
  price_metadata?: Record<string, unknown>;
  trial_starts_at?: string | Date | null;
  trial_ends_at?: string | Date | null;
  starts_at?: string | Date | null;
  ends_at?: string | Date | null;
  current_period_start?: string | Date | null;
  current_period_end?: string | Date | null;
  cancel_at?: string | Date | null;
  metadata?: Record<string, unknown>;
};

export type CommercialCheckInput = {
  customer: string;
  feature: string;
  quantity?: number;
};

export type CommercialCheckResult = {
  ok: true;
  allowed: boolean;
  reason: string;
  quantity: number;
  subscription: {
    active: boolean;
    expired: boolean;
    status: string | null;
    expires_at: string | null;
    days_remaining: number | null;
    plan_key: string | null;
  };
  entitlement: {
    enabled: boolean;
    limit: number | null;
  };
  usage: {
    used: number;
    limit: number | null;
    remaining: number | null;
  };
  trial: {
    active: boolean;
    starts_at: string | null;
    ends_at: string | null;
  };
  seats?: {
    purchased: number;
    assigned: number;
    available: number;
  };
};

export type CommercialConsumeInput = CommercialCheckInput;

export type CommercialConsumeResult = CommercialCheckResult & {
  consumed?: number;
};

export type CommercialStateInput = {
  customer: string;
  include_billing?: boolean;
};

export type CommercialStateResult = {
  ok: true;
  customer: CommercialCustomer;
  subscription: CommercialSubscription | null;
  plan: {
    key: string;
    name: string;
    interval: CommercialPlanInterval;
    interval_days?: number;
  } | null;
  features: Record<
    string,
    {
      enabled: boolean;
      kind: string;
      limit: number | null;
      used: number;
      remaining: number | null;
    }
  >;
  trial: {
    active: boolean;
    starts_at: string | null;
    ends_at: string | null;
  };
  seats?: {
    purchased: number;
    assigned: number;
    available: number;
  };
  invoices?: unknown[];
  payments?: unknown[];
};

export type CommercialListCustomersResponse = {
  ok: true;
  customers: CommercialCustomer[];
  pagination: CommercialPaginationMeta;
};

export type CommercialListFeaturesResponse = {
  ok: true;
  features: CommercialFeature[];
  pagination: CommercialPaginationMeta;
};

export type CommercialListPlansResponse = {
  ok: true;
  plans: CommercialPlan[];
  pagination: CommercialPaginationMeta;
};

export type CommercialListSubscriptionsParams = CommercialListParams & {
  customer_id?: string;
  customer?: string;
  customer_key?: string;
  status?: string;
  include_archived?: boolean | string;
};

export type CommercialListSubscriptionsResponse = {
  ok: true;
  subscriptions: CommercialSubscription[];
  pagination: CommercialPaginationMeta;
};

export type CommercialInvoice = {
  _id: string;
  tenant_id: string;
  app_id: string;
  customer_id: string;
  customer_key?: string;
  customer_name?: string;
  customer_email?: string;
  subscription_id?: string;
  provider: string;
  provider_type?: string;
  provider_name?: string;
  payment_method_key?: string;
  provider_invoice_id?: string;
  status: string;
  currency: string;
  amount: number;
  line_items?: Array<Record<string, unknown>>;
  subtotal?: number;
  discount_total?: number;
  tax_total?: number;
  total?: number;
  period_start?: string | Date;
  period_end?: string | Date;
  due_at?: string | Date;
  paid_at?: string | Date;
  metadata?: Record<string, unknown>;
  createdAt?: string | Date;
  updatedAt?: string | Date;
};

export type CommercialListInvoicesParams = CommercialListParams & {
  customer_id?: string;
  customer?: string;
  customer_key?: string;
  subscription_id?: string;
  status?: string;
};

export type CommercialListInvoicesResponse = {
  ok: true;
  invoices: CommercialInvoice[];
  pagination: CommercialPaginationMeta;
};

export type CommercialPricingQuoteInput = {
  plan: string;
  customer?: string;
  currency?: string;
  discount_code?: string;
  tax_rate?: string;
  addons?: Array<{ key: string; quantity: number }>;
  seats_purchased?: number;
  metadata?: Record<string, unknown>;
};

export type CommercialPricingQuote = {
  currency: string;
  plan_key: string;
  plan_amount: number;
  addon_total: number;
  seat_total: number;
  subtotal: number;
  discount_total: number;
  tax_total: number;
  total: number;
  line_items: Array<{
    kind: string;
    description: string;
    quantity: number;
    unit_amount: number;
    amount: number;
    currency: string;
    metadata?: Record<string, unknown>;
  }>;
  discount?: Record<string, unknown> | null;
  tax_rate_key?: string | null;
  metadata?: Record<string, unknown>;
};

export type CommercialCreateSubscriptionInput = {
  customer: string;
  plan: string;
  status?: string;
  currency?: string;
  discount_code?: string;
  tax_rate?: string;
  addons?: Array<{ key: string; quantity: number }>;
  seats_purchased?: number;
  metadata?: Record<string, unknown>;
  payment_method?: string;
  payment_input?: Record<string, unknown>;
};

export type CommercialChangePlanInput = {
  subscriptionId: string;
  plan: string;
  currency?: string;
  discount_code?: string;
  tax_rate?: string;
  addons?: Array<{ key: string; quantity: number }>;
  seats_purchased?: number;
  payment_method?: string;
  payment_input?: Record<string, unknown>;
};

export type CommercialPaymentMethodSummary = {
  key: string;
  name: string;
  is_default: boolean;
  connector_name?: string;
  action_name?: string;
  renewal_mode: "platform" | "provider";
};

export type CommercialInitiatePaymentInput = {
  customer: string;
  subscription?: string;
  invoice?: string;
  payment_method?: string;
  input?: Record<string, unknown>;
  currency?: string;
  discount_code?: string;
};

export type CommercialInitiatePaymentResult = {
  ok: boolean;
  reference: string;
  invoice: {
    _id: string;
    status: string;
    currency: string;
    amount: number;
    total?: number;
  };
  charge: unknown;
};

export type CommercialConfirmPaymentInput = {
  reference: string;
  status: "succeeded" | "failed" | "pending";
  provider_payment_id?: string;
  failure_reason?: string;
  metadata?: Record<string, unknown>;
};

export type CommercialConfirmPaymentResult = {
  ok: true;
  reference: string;
  invoice: {
    _id: string;
    status: string;
    currency: string;
    amount: number;
    total?: number;
  };
  payment: {
    _id?: string;
    status: string;
    provider_payment_id?: string;
  };
};

export type CommercialUpdateSubscriptionStatusInput = {
  subscriptionId: string;
  status: string;
};

export type CommercialSeatAssignInput = {
  customer: string;
  subject_key: string;
  email?: string;
  metadata?: Record<string, unknown>;
};

export type CommercialLicenseIssueInput = {
  customer: string;
  expires_at?: string;
  metadata?: Record<string, unknown>;
};

export type CommercialLicenseValidateInput = {
  license_key: string;
};

export type CommercialAnalyticsParams = {
  period?: string;
  from?: string;
  to?: string;
  granularity?: string;
  customer_ids?: string[] | string;
  customer_keys?: string[] | string;
  plan_keys?: string[] | string;
  statuses?: string[] | string;
  feature_keys?: string[] | string;
  event_types?: string[] | string;
  currency?: string;
  expiring_within_days?: number;
  include_charts?: boolean;
  include_tables?: boolean;
  include_insights?: boolean;
  limit?: number;
};

export type CommercialAppClientApi = {
  check(input: CommercialCheckInput): Promise<CommercialCheckResult>;
  consume(input: CommercialConsumeInput): Promise<CommercialConsumeResult>;
  state(input: CommercialStateInput): Promise<CommercialStateResult>;
  getCustomerSubscription(
    customerId: string,
    options?: { include_billing?: boolean }
  ): Promise<CommercialStateResult>;
  listCustomers(
    params?: CommercialListParams
  ): Promise<CommercialListCustomersResponse>;
  getCustomer(customerId: string): Promise<{ ok: true; customer: CommercialCustomer }>;
  createCustomer(
    input: CommercialCreateCustomerInput
  ): Promise<{ ok: true; customer: CommercialCustomer }>;
  listFeatures(
    params?: CommercialListParams
  ): Promise<CommercialListFeaturesResponse>;
  getFeature(featureId: string): Promise<{ ok: true; feature: CommercialFeature }>;
  listPlans(params?: CommercialListParams): Promise<CommercialListPlansResponse>;
  getPlan(planId: string): Promise<{ ok: true; plan: CommercialPlan }>;
  listSubscriptions(
    params?: CommercialListSubscriptionsParams
  ): Promise<CommercialListSubscriptionsResponse>;
  getSubscription(
    subscriptionId: string
  ): Promise<{ ok: true; subscription: CommercialSubscription }>;
  listInvoices(
    params?: CommercialListInvoicesParams
  ): Promise<CommercialListInvoicesResponse>;
  getInvoice(
    invoiceId:
      | string
      | {
          invoiceId?: string;
          _id?: string;
          id?: string;
          reference?: string;
        }
  ): Promise<{ ok: true; invoice: CommercialInvoice }>;
  createSubscription(
    input: CommercialCreateSubscriptionInput
  ): Promise<{ ok: true; subscription: CommercialSubscription }>;
  subscribe(
    input: CommercialCreateSubscriptionInput
  ): Promise<{ ok: true; subscription: CommercialSubscription }>;
  changePlan(
    input: CommercialChangePlanInput
  ): Promise<{ ok: true; subscription: CommercialSubscription }>;
  updateSubscriptionStatus(
    input: CommercialUpdateSubscriptionStatusInput
  ): Promise<{ ok: true; subscription: CommercialSubscription }>;
  archiveSubscription(
    subscriptionId: string
  ): Promise<{ ok: true; subscription: CommercialSubscription }>;
  quote(
    input: CommercialPricingQuoteInput
  ): Promise<{ ok: true; quote: CommercialPricingQuote }>;
  listPaymentMethods(): Promise<{
    ok: true;
    payment_methods: CommercialPaymentMethodSummary[];
  }>;
  initiatePayment(
    input: CommercialInitiatePaymentInput
  ): Promise<CommercialInitiatePaymentResult>;
  confirmPayment(
    input: CommercialConfirmPaymentInput
  ): Promise<CommercialConfirmPaymentResult>;
  previewDiscount(input: {
    code: string;
    plan: string;
    currency?: string;
    customer?: string;
  }): Promise<{ ok: true; discount: unknown; quote: unknown }>;
  listDiscounts(
    params?: CommercialListParams
  ): Promise<{ ok: true; discounts: unknown[]; pagination: CommercialPaginationMeta }>;
  listTaxRates(
    params?: CommercialListParams
  ): Promise<{ ok: true; tax_rates: unknown[]; pagination: CommercialPaginationMeta }>;
  listAddons(
    params?: CommercialListParams
  ): Promise<{ ok: true; addons: unknown[]; pagination: CommercialPaginationMeta }>;
  assignSeat(
    input: CommercialSeatAssignInput
  ): Promise<{ ok: true; assignment: unknown }>;
  unassignSeat(input: CommercialSeatAssignInput): Promise<{ ok: boolean }>;
  issueLicense(
    input: CommercialLicenseIssueInput
  ): Promise<{ ok: true; license: unknown; license_key: string }>;
  validateLicense(
    input: CommercialLicenseValidateInput
  ): Promise<{ ok: true; valid: boolean; [key: string]: unknown }>;
  revokeLicense(licenseId: string): Promise<{ ok: true; license: unknown }>;
  analytics(params?: CommercialAnalyticsParams): Promise<{ ok: true; analytics: unknown }>;
  analyticsCharts(
    params?: CommercialAnalyticsParams
  ): Promise<{ ok: true; [key: string]: unknown }>;
};
