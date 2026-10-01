export type CommercialAppClientConfig = {
  baseUrl: string;
  appId: string;
  apiKey?: string;
  appApiKey?: string;
  appSecret?: string;
  debug?: boolean;
  /** Pin project env bag for connector auth templates. Omit to follow the project switch. */
  environment?: "dev" | "prod" | "development" | "production";
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
  credit_balances?: Array<{ currency: string; amount: number }>;
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

export type CommercialUpdateCustomerInput = {
  name?: string;
  email?: string | null;
  preferred_currency?: string | null;
  tax_ids?: Array<{ type: string; value: string }>;
  billing_address?: {
    country: string;
    region?: string;
    city?: string;
    line1?: string;
    postal_code?: string;
  } | null;
  metadata?: Record<string, unknown> | null;
  status?: string;
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
  unit_prices?: CommercialPrice[];
  topup_packs?: Array<{ units: number; prices: CommercialPrice[] }>;
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
  billing_mode?: "recurring" | "payg" | "hybrid" | string;
  payg_overage_policy?:
    | "deny"
    | "accrue"
    | "immediate_topup"
    | "accrue_and_topup"
    | string;
  payg_charge_threshold_amount?: number;
  payg_hard_cap_amount?: number;
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
  pricing?: {
    currency: string;
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
  };
  auto_renew?: boolean;
  renewal_mode?: "platform" | "provider";
  skip_trial?: boolean;
  usage_rollover?: "none" | "carry_unused";
  pending_plan_change?: Record<string, unknown> | null;
  usage_rollover_credits?: Record<string, number>;
  billing_mode?: "recurring" | "payg" | "hybrid" | string;
  payg_overage_policy?:
    | "deny"
    | "accrue"
    | "immediate_topup"
    | "accrue_and_topup"
    | string;
  payg_charge_threshold_amount?: number;
  payg_hard_cap_amount?: number;
  unbilled_usage?: {
    currency: string;
    amount: number;
    units_by_feature?: Record<string, number>;
    amounts_by_feature?: Record<string, number>;
    since?: string | Date;
  };
  payg_charge_status?: "idle" | "processing" | "failed" | string;
  payg_pack_credits?: Record<string, number>;
  pending_topup_invoice_id?: string;
  payment_method_key?: string;
  payment_card_id?: string;
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
  topup_packs?: Array<{ units: number; prices: CommercialPrice[] }>;
  pending_topup_invoice_id?: string;
  unbilled?: {
    currency: string;
    amount: number;
    units_by_feature?: Record<string, number>;
    amounts_by_feature?: Record<string, number>;
  };
  payg?: {
    billing_mode: string;
    overage_policy: string;
    charge_status: string;
  };
  breakdown?: CommercialConsumeBreakdown;
};

export type CommercialConsumeBreakdown = {
  feature_key: string;
  quantity: number;
  currency?: string;
  unit_amount?: number | null;
  cost: number;
  plan_quantity: number;
  pack_quantity: number;
  overage_quantity: number;
  credited_amount: number;
  accrued_amount: number;
  credited_quantity?: number;
  accrued_quantity?: number;
  unbilled_after?: number;
  credit_balance_after?: number;
  summary: string;
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
  invoices?: CommercialInvoice[];
  payments?: Array<Record<string, unknown>>;
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

export type CommercialInvoiceLineItem = {
  kind: string;
  description: string;
  quantity: number;
  unit_amount: number;
  amount: number;
  currency: string;
  metadata?: Record<string, unknown>;
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
  line_items?: CommercialInvoiceLineItem[];
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
  card?: string;
  card_id?: string;
  payment_input?: Record<string, unknown>;
  auto_renew?: boolean;
  renewal_mode?: "platform" | "provider";
  skip_trial?: boolean;
  usage_rollover?: "none" | "carry_unused";
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
  card?: string;
  card_id?: string;
  payment_input?: Record<string, unknown>;
  auto_renew?: boolean;
  renewal_mode?: "platform" | "provider";
  apply_at?: "immediate" | "next_renewal";
  usage_rollover?: "none" | "carry_unused";
};

export type CommercialUpdatePendingSubscriptionInput = {
  subscriptionId: string;
  plan?: string;
  currency?: string;
  discount_code?: string;
  tax_rate?: string;
  addons?: Array<{ key: string; quantity: number }>;
  seats_purchased?: number;
  payment_method?: string;
  card?: string;
  card_id?: string;
  payment_input?: Record<string, unknown>;
  auto_renew?: boolean;
  renewal_mode?: "platform" | "provider";
  skip_trial?: boolean;
  metadata?: Record<string, unknown>;
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
  card?: string;
  card_id?: string;
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
    metadata?: Record<string, unknown>;
  };
  charge: unknown;
  error?: string;
  failure_reason?: string;
};

export type CommercialChargeUsageInput = {
  subscriptionId: string;
  amount?: number;
  payment_method?: string;
  card?: string;
  card_id?: string;
  payment_input?: Record<string, unknown>;
};

export type CommercialChargeUsageResult = CommercialInitiatePaymentResult & {
  billed_amount: number;
  unbilled_remaining: number;
};

export type CommercialRenewSubscriptionInput = {
  subscriptionId: string;
  payment_method?: string;
};

export type CommercialRenewSubscriptionResult = {
  ok: true;
  invoice: CommercialInvoice;
  subscription: CommercialSubscription;
  created: boolean;
};

export type CommercialCreditBalance = {
  currency: string;
  amount: number;
};

export type CommercialCreditLedgerEvent = {
  _id: string;
  tenant_id: string;
  app_id: string;
  customer_id: string;
  currency: string;
  delta: number;
  balance_after: number;
  reason: string;
  invoice_id?: string;
  subscription_id?: string;
  feature_key?: string;
  quantity?: number;
  unit_amount?: number;
  cost?: number;
  plan_quantity?: number;
  pack_quantity?: number;
  overage_quantity?: number;
  credited_amount?: number;
  accrued_amount?: number;
  summary?: string;
  at: string | Date;
  createdAt?: string | Date;
};

export type CommercialListCreditsParams = CommercialListParams;

export type CommercialListCreditsResponse = {
  ok: true;
  credit_balances: CommercialCreditBalance[];
  events: CommercialCreditLedgerEvent[];
  pagination: Pick<CommercialPaginationMeta, "totalDocs" | "page" | "limit"> &
    Partial<CommercialPaginationMeta>;
};

export type CommercialCustomerCard = {
  _id: string;
  tenant_id: string;
  app_id: string;
  customer_id: string;
  token?: string;
  fingerprint?: string;
  last4?: string;
  brand?: string;
  exp_month?: number;
  exp_year?: number;
  payment_method_key?: string;
  provider_customer_id?: string;
  is_default: boolean;
  status: "active" | "expired" | "revoked" | string;
  metadata?: Record<string, unknown>;
  createdAt?: string | Date;
  updatedAt?: string | Date;
};

export type CommercialAddCardInput = {
  token?: string;
  authorization_code?: string;
  fingerprint?: string;
  hash?: string;
  last4?: string;
  brand?: string;
  exp_month?: number;
  exp_year?: number;
  payment_method_key?: string;
  provider_customer_id?: string;
  is_default?: boolean;
  metadata?: Record<string, unknown>;
};

export type CommercialListCardsParams = CommercialListParams & {
  include_revoked?: boolean;
};

export type CommercialListCardsResponse = {
  ok: true;
  cards: CommercialCustomerCard[];
  pagination: CommercialPaginationMeta;
};

export type CommercialLifecycleEvent = {
  _id: string;
  tenant_id: string;
  app_id: string;
  customer_id?: string;
  subscription_id?: string;
  type: string;
  at: string | Date;
  actor?: string;
  actor_id?: string;
  payload?: Record<string, unknown>;
  createdAt?: string | Date;
};

export type CommercialUsageEvent = {
  _id: string;
  tenant_id: string;
  app_id: string;
  customer_id: string;
  subscription_id?: string;
  feature_key: string;
  quantity: number;
  period_key: string;
  at: string | Date;
  allowed: boolean;
  remaining?: number | null;
  reason?: string;
  currency?: string;
  unit_amount?: number | null;
  cost?: number;
  plan_quantity?: number;
  pack_quantity?: number;
  overage_quantity?: number;
  credited_amount?: number;
  accrued_amount?: number;
  credited_quantity?: number;
  accrued_quantity?: number;
  unbilled_after?: number;
  credit_balance_after?: number;
  summary?: string;
  createdAt?: string | Date;
};

export type CommercialListEventsParams = CommercialListParams & {
  type?: string;
  feature?: string;
};

export type CommercialListEventsResponse = {
  ok: true;
  events: CommercialLifecycleEvent[];
  pagination: CommercialPaginationMeta;
};

export type CommercialListUsageEventsResponse = {
  ok: true;
  events: CommercialUsageEvent[];
  pagination: CommercialPaginationMeta;
};

export type CommercialDiscount = {
  _id: string;
  key?: string;
  code?: string;
  name?: string;
  type?: string;
  percent?: number;
  amount?: number;
  currency?: string;
  duration?: string;
  metadata?: Record<string, unknown>;
};

export type CommercialTaxRate = {
  _id: string;
  key?: string;
  name?: string;
  percent?: number;
  inclusive?: boolean;
  country?: string;
  metadata?: Record<string, unknown>;
};

export type CommercialAddon = {
  _id: string;
  key: string;
  name: string;
  kind?: string;
  prices?: CommercialPrice[];
  metadata?: Record<string, unknown>;
};

export type CommercialSeatAssignment = {
  _id: string;
  customer_id: string;
  subscription_id?: string;
  subject_key: string;
  email?: string;
  metadata?: Record<string, unknown>;
  assigned_at?: string | Date;
};

export type CommercialLicense = {
  _id: string;
  customer_id: string;
  license_key_prefix?: string;
  status: string;
  plan_key?: string;
  expires_at?: string | Date | null;
  metadata?: Record<string, unknown>;
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

export type CommercialEntitlementTopupInput = {
  subscriptionId: string;
  feature: string;
  pack_units?: number;
  pack_index?: number;
  payment_method?: string;
  card?: string;
  card_id?: string;
  payment_input?: Record<string, unknown>;
};

export type CommercialCreditsTopupInput = {
  customerId: string;
  currency: string;
  amount: number;
  payment_method?: string;
  card?: string;
  card_id?: string;
  payment_input?: Record<string, unknown>;
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

/** Common settle_in presets (ledger also accepts raw strings like `T+0`, `1d`, `24h`). */
export const CommercialLedgerSettleIn = {
  T0: "T+0",
  T1: "T+1",
  T2: "T+2",
} as const;
export type CommercialLedgerSettleIn =
  (typeof CommercialLedgerSettleIn)[keyof typeof CommercialLedgerSettleIn];

export const CommercialAnalyticsPeriod = {
  H24: "24h",
  D7: "7d",
  D30: "30d",
  D90: "90d",
  Y1: "1y",
  Custom: "custom",
} as const;
export type CommercialAnalyticsPeriod =
  (typeof CommercialAnalyticsPeriod)[keyof typeof CommercialAnalyticsPeriod];

export const CommercialAnalyticsGranularity = {
  Hour: "hour",
  Day: "day",
  Week: "week",
  Month: "month",
} as const;
export type CommercialAnalyticsGranularity =
  (typeof CommercialAnalyticsGranularity)[keyof typeof CommercialAnalyticsGranularity];

export const CommercialLedgerTransactionType = {
  Credit: "credit",
  Debit: "debit",
  Transfer: "transfer",
  Reversal: "reversal",
  Hold: "hold",
  HoldRelease: "hold_release",
  HoldCapture: "hold_capture",
  Exchange: "exchange",
} as const;
export type CommercialLedgerTransactionType =
  (typeof CommercialLedgerTransactionType)[keyof typeof CommercialLedgerTransactionType];

export type CommercialLedgerFeeCollectorInput =
  | string
  | { customer: string; key?: string };

export type CommercialLedgerFeeRule = {
  type: "percent" | "flat" | "percent_plus_flat" | string;
  percent_bps?: number;
  flat?: number;
  min?: number;
  max?: number;
  mode?: "on_top" | "inclusive" | string;
  collector?: CommercialLedgerFeeCollectorInput;
  collector_wallet_id?: string;
  reason?: string;
};

export type CommercialLedgerFeePolicy = {
  credit?: CommercialLedgerFeeRule | null;
  debit?: CommercialLedgerFeeRule | null;
  transfer?: CommercialLedgerFeeRule | null;
  collector?: CommercialLedgerFeeCollectorInput;
  collector_wallet_id?: string;
};

export type CommercialLedgerFeeOverride =
  | false
  | {
      amount: number;
      mode?: "on_top" | "inclusive" | string;
      reason?: string;
      collector?: CommercialLedgerFeeCollectorInput;
    };

export type CommercialLedgerSettlementPolicy = {
  settle_in?: string;
};

export type CommercialLedgerUnitInput =
  | string
  | {
      unit: string;
      metadata?: Record<string, unknown>;
      settlement?: CommercialLedgerSettlementPolicy;
      fees?: CommercialLedgerFeePolicy | null;
    };

export type CommercialWallet = {
  _id: string;
  tenant_id?: string;
  app_id?: string;
  customer_id: string;
  key: string;
  name?: string;
  status: string;
  units?: Array<{
    unit: string;
    metadata?: Record<string, unknown>;
    settlement?: CommercialLedgerSettlementPolicy;
    fees?: CommercialLedgerFeePolicy | null;
  }>;
  metadata?: Record<string, unknown>;
  settlement?: CommercialLedgerSettlementPolicy;
  fees?: CommercialLedgerFeePolicy | null;
  createdAt?: string | Date;
  updatedAt?: string | Date;
  [key: string]: unknown;
};

export type CommercialWalletAccount = {
  _id: string;
  tenant_id?: string;
  app_id?: string;
  customer_id: string;
  wallet_id: string;
  unit: string;
  available: number;
  held: number;
  unsettled: number;
  total?: number;
  version?: number;
  metadata?: Record<string, unknown>;
  settlement?: CommercialLedgerSettlementPolicy;
  createdAt?: string | Date;
  updatedAt?: string | Date;
  [key: string]: unknown;
};

export type CommercialWalletEntry = {
  _id: string;
  customer_id?: string;
  wallet_id?: string;
  account_id?: string;
  transaction_id?: string;
  type: string;
  unit: string;
  amount: number;
  balance_after?: number;
  available_after?: number;
  held_after?: number;
  unsettled_after?: number;
  reference?: string;
  reason?: string;
  invoice_id?: string;
  fee_id?: string;
  metadata?: Record<string, unknown>;
  createdAt?: string | Date;
  updatedAt?: string | Date;
  [key: string]: unknown;
};

export type CommercialWalletTransactionFee = {
  amount: number;
  mode?: string;
  charged_to?: string;
  resolution?: string;
  source?: string;
  operation?: string;
  fee_entry_id?: string;
  collector_wallet_id?: string;
  collector_account_id?: string;
  collector_entry_id?: string;
  collector_transaction_id?: string;
};

export type CommercialWalletTransaction = {
  _id: string;
  type: string;
  status: string;
  origin?: string;
  unit: string;
  amount: number;
  source_wallet_id?: string;
  source_account_id?: string;
  dest_wallet_id?: string;
  dest_account_id?: string;
  reference?: string;
  reverses_id?: string;
  reversed_by_id?: string;
  rate?: string;
  from_unit?: string;
  from_amount?: number;
  to_unit?: string;
  to_amount?: number;
  quoted_at?: string | Date;
  settle_at?: string | Date;
  settled_at?: string | Date;
  voided_at?: string | Date;
  gross_amount?: number;
  fee_amount?: number;
  net_amount?: number;
  fee_id?: string;
  fee?: CommercialWalletTransactionFee;
  metadata?: Record<string, unknown>;
  entries?: CommercialWalletEntry[];
  createdAt?: string | Date;
  updatedAt?: string | Date;
  [key: string]: unknown;
};

export type CommercialWalletHold = {
  _id: string;
  wallet_id: string;
  account_id?: string;
  customer_id?: string;
  unit: string;
  amount: number;
  reason: string;
  status: string;
  reference?: string;
  hold_transaction_id?: string;
  terminal_transaction_id?: string;
  captured_at?: string | Date;
  released_at?: string | Date;
  createdAt?: string | Date;
  updatedAt?: string | Date;
  [key: string]: unknown;
};

export type CommercialWalletUnit = {
  _id: string;
  code: string;
  name: string;
  precision: number;
  kind?: string;
  settlement?: CommercialLedgerSettlementPolicy;
  createdAt?: string | Date;
  updatedAt?: string | Date;
  [key: string]: unknown;
};

export type CommercialListWalletsResponse = {
  ok: true;
  wallets: CommercialWallet[];
  pagination: CommercialPaginationMeta;
};

export type CommercialCreateWalletInput = {
  key?: string;
  name?: string;
  metadata?: Record<string, unknown>;
  units?: CommercialLedgerUnitInput[];
  settlement?: CommercialLedgerSettlementPolicy;
  fees?: CommercialLedgerFeePolicy | null;
};

export type CommercialUpdateWalletInput = {
  name?: string | null;
  metadata?: Record<string, unknown> | null;
  units?: CommercialLedgerUnitInput[];
  settlement?: CommercialLedgerSettlementPolicy | null;
  fees?: CommercialLedgerFeePolicy | null;
};

export type CommercialOpenAccountInput = {
  unit: string;
  metadata?: Record<string, unknown>;
};

export type CommercialUpdateAccountInput = {
  metadata?: Record<string, unknown> | null;
  settlement?: CommercialLedgerSettlementPolicy | null;
};

export type CommercialGetAccountOptions = {
  customerId?: string;
  walletId?: string;
};

export type CommercialListTransactionsParams = CommercialListParams & {
  status?: string;
  settle_at_from?: string;
  settle_at_to?: string;
  amount?: number;
  unit?: string;
  currency?: string;
  reference?: string;
};

export type CommercialListHoldsParams = CommercialListParams & {
  status?: string;
};

export type CommercialLedgerAmountInput = {
  unit: string;
  amount: number;
  reference: string;
  reason?: string;
  invoice_id?: string;
  settle_in?: string;
  settle_at?: string;
  fee?: CommercialLedgerFeeOverride;
  metadata?: Record<string, unknown>;
};

export type CommercialTransferInput = {
  to: string | { customer: string; key?: string };
  unit: string;
  amount: number;
  reference?: string;
  settle_in?: string;
  settle_at?: string;
  fee?: CommercialLedgerFeeOverride;
  metadata?: Record<string, unknown>;
};

export type CommercialHoldInput = {
  unit: string;
  amount: number;
  reason: string;
  reference?: string;
  metadata?: Record<string, unknown>;
};

export type CommercialCreateUnitInput = {
  code: string;
  name: string;
  precision: number;
  settlement?: CommercialLedgerSettlementPolicy;
};

export type CommercialExchangeInput = {
  from: { unit: string; amount: number };
  to: { unit: string; amount?: number };
  rate: string;
  reference?: string;
  metadata?: Record<string, unknown>;
};

export type CommercialLedgerAnalyticsParams = {
  period?: string;
  from?: string;
  to?: string;
  granularity?: string;
  unit?: string;
  units?: string[] | string;
  customer_ids?: string[] | string;
  customer_keys?: string[] | string;
  wallet_id?: string;
  wallet_key?: string;
  types?: string[] | string;
  include_charts?: boolean;
  include_tables?: boolean;
  include_insights?: boolean;
  include_all_time?: boolean;
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
  updateCustomer(
    customerId: string,
    input: CommercialUpdateCustomerInput
  ): Promise<{ ok: true; customer: CommercialCustomer }>;
  listCredits(
    customerId: string,
    params?: CommercialListCreditsParams
  ): Promise<CommercialListCreditsResponse>;
  topupCredits(
    input: CommercialCreditsTopupInput
  ): Promise<{ ok: true; invoice: CommercialInvoice }>;
  listWallets(
    customerId: string,
    params?: CommercialListParams
  ): Promise<CommercialListWalletsResponse>;
  createWallet(
    customerId: string,
    input?: CommercialCreateWalletInput
  ): Promise<{
    ok: true;
    wallet: CommercialWallet;
    accounts?: CommercialWalletAccount[];
  }>;
  updateWallet(
    customerId: string,
    walletId: string,
    input: CommercialUpdateWalletInput
  ): Promise<{
    ok: true;
    wallet: CommercialWallet;
    accounts?: CommercialWalletAccount[];
  }>;
  getWallet(
    customerId: string,
    walletId: string
  ): Promise<{
    ok: true;
    wallet: CommercialWallet;
    accounts?: CommercialWalletAccount[];
  }>;
  listAccounts(
    customerId: string,
    walletId: string
  ): Promise<{ ok: true; accounts: CommercialWalletAccount[] }>;
  openAccount(
    customerId: string,
    walletId: string,
    input: CommercialOpenAccountInput
  ): Promise<{ ok: true; account: CommercialWalletAccount }>;
  updateAccount(
    customerId: string,
    walletId: string,
    accountId: string,
    input: CommercialUpdateAccountInput
  ): Promise<{ ok: true; account: CommercialWalletAccount }>;
  getAccount(
    accountId: string,
    options?: CommercialGetAccountOptions
  ): Promise<{ ok: true; account: CommercialWalletAccount }>;
  listEntries(
    customerId: string,
    walletId: string,
    params?: CommercialListParams
  ): Promise<{
    ok: true;
    entries: CommercialWalletEntry[];
    pagination: CommercialPaginationMeta;
  }>;
  listTransactions(
    customerId: string,
    walletId: string,
    params?: CommercialListTransactionsParams
  ): Promise<{
    ok: true;
    transactions: CommercialWalletTransaction[];
    pagination: CommercialPaginationMeta;
  }>;
  getTransaction(transactionId: string): Promise<{
    ok: true;
    transaction: CommercialWalletTransaction;
    [key: string]: unknown;
  }>;
  credit(
    customerId: string,
    walletId: string,
    input: CommercialLedgerAmountInput
  ): Promise<{ ok: true; [key: string]: unknown }>;
  debit(
    customerId: string,
    walletId: string,
    input: CommercialLedgerAmountInput
  ): Promise<{ ok: true; [key: string]: unknown }>;
  transfer(
    customerId: string,
    walletId: string,
    input: CommercialTransferInput
  ): Promise<{ ok: true; [key: string]: unknown }>;
  reverseTransaction(
    transactionId: string,
    input?: { reference?: string }
  ): Promise<{ ok: true; [key: string]: unknown }>;
  settleTransaction(
    transactionId: string
  ): Promise<{ ok: true; [key: string]: unknown }>;
  voidTransaction(
    transactionId: string
  ): Promise<{ ok: true; [key: string]: unknown }>;
  listHolds(
    customerId: string,
    walletId: string,
    params?: CommercialListHoldsParams
  ): Promise<{
    ok: true;
    holds: CommercialWalletHold[];
    pagination: CommercialPaginationMeta;
  }>;
  hold(
    customerId: string,
    walletId: string,
    input: CommercialHoldInput
  ): Promise<{ ok: true; [key: string]: unknown }>;
  captureHold(
    customerId: string,
    walletId: string,
    holdId: string,
    input?: { reference?: string }
  ): Promise<{ ok: true; [key: string]: unknown }>;
  releaseHold(
    customerId: string,
    walletId: string,
    holdId: string,
    input?: { reference?: string }
  ): Promise<{ ok: true; [key: string]: unknown }>;
  listUnits(): Promise<{
    ok: true;
    units: CommercialWalletUnit[];
    iso_without_catalog?: boolean;
  }>;
  createUnit(
    input: CommercialCreateUnitInput
  ): Promise<{ ok: true; unit: CommercialWalletUnit }>;
  exchange(
    customerId: string,
    walletId: string,
    input: CommercialExchangeInput
  ): Promise<{ ok: true; [key: string]: unknown }>;
  listCards(
    customerId: string,
    params?: CommercialListCardsParams
  ): Promise<CommercialListCardsResponse>;
  addCard(
    customerId: string,
    input: CommercialAddCardInput
  ): Promise<{ ok: true; card: CommercialCustomerCard }>;
  updateCard(
    customerId: string,
    cardId: string,
    input: CommercialAddCardInput
  ): Promise<{ ok: true; card: CommercialCustomerCard }>;
  removeCard(
    customerId: string,
    cardId: string
  ): Promise<{ ok: true; card: CommercialCustomerCard }>;
  setDefaultCard(
    customerId: string,
    cardId: string
  ): Promise<{ ok: true; card: CommercialCustomerCard }>;
  listEvents(
    customerId: string,
    params?: CommercialListEventsParams
  ): Promise<CommercialListEventsResponse>;
  listUsageEvents(
    customerId: string,
    params?: CommercialListEventsParams
  ): Promise<CommercialListUsageEventsResponse>;
  listEventTypes(): Promise<{ ok: true; event_types: string[] }>;
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
  updatePendingSubscription(
    input: CommercialUpdatePendingSubscriptionInput
  ): Promise<{ ok: true; subscription: CommercialSubscription }>;
  changePlan(
    input: CommercialChangePlanInput
  ): Promise<{ ok: true; subscription: CommercialSubscription }>;
  entitlementTopup(
    input: CommercialEntitlementTopupInput
  ): Promise<{ ok: true; invoice: CommercialInvoice; subscription: CommercialSubscription }>;
  chargeUsage(
    input: CommercialChargeUsageInput
  ): Promise<CommercialChargeUsageResult>;
  renewSubscription(
    input: CommercialRenewSubscriptionInput
  ): Promise<CommercialRenewSubscriptionResult>;
  renew(
    input: CommercialRenewSubscriptionInput
  ): Promise<CommercialRenewSubscriptionResult>;
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
  }): Promise<{ ok: true; discount: CommercialDiscount; quote: CommercialPricingQuote }>;
  listDiscounts(
    params?: CommercialListParams
  ): Promise<{ ok: true; discounts: CommercialDiscount[]; pagination: CommercialPaginationMeta }>;
  listTaxRates(
    params?: CommercialListParams
  ): Promise<{ ok: true; tax_rates: CommercialTaxRate[]; pagination: CommercialPaginationMeta }>;
  listAddons(
    params?: CommercialListParams
  ): Promise<{ ok: true; addons: CommercialAddon[]; pagination: CommercialPaginationMeta }>;
  assignSeat(
    input: CommercialSeatAssignInput
  ): Promise<{ ok: true; assignment: CommercialSeatAssignment }>;
  unassignSeat(input: CommercialSeatAssignInput): Promise<{ ok: boolean }>;
  issueLicense(
    input: CommercialLicenseIssueInput
  ): Promise<{ ok: true; license: CommercialLicense; license_key: string }>;
  validateLicense(
    input: CommercialLicenseValidateInput
  ): Promise<{ ok: true; valid: boolean; license?: CommercialLicense; [key: string]: unknown }>;
  revokeLicense(licenseId: string): Promise<{ ok: true; license: CommercialLicense }>;
  analytics(params?: CommercialAnalyticsParams): Promise<{ ok: true; analytics: unknown }>;
  analyticsCharts(
    params?: CommercialAnalyticsParams
  ): Promise<{ ok: true; [key: string]: unknown }>;
  ledgerAnalytics(
    params?: CommercialLedgerAnalyticsParams
  ): Promise<{ ok: true; analytics: unknown }>;
  ledgerAnalyticsCharts(
    params?: CommercialLedgerAnalyticsParams
  ): Promise<{ ok: true; [key: string]: unknown }>;
};
