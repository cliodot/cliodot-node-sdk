export type ValidatorName =
  | "not_empty"
  | "is_empty"
  | "contains"
  | "not_contains"
  | "begins_with"
  | "ends_with"
  | "is_in"
  | "not_in"
  | "is_email"
  | "is_phone"
  | "length"
  | "range"
  | "matches"
  | "is_number"
  | "is_string"
  | "is_boolean"
  | "is_array"
  | "is_object"
  | "equals"
  | "not_equals"
  | "greater_than"
  | "greater_than_or_equal"
  | "less_than"
  | "less_than_or_equal"
  | "is_url"
  | "is_date"
  | "is_address"
  | "required"
  | string;

export interface ValidatorConfig {
  message?: string;
  search?: string;
  caseSensitive?: boolean;
  prefix?: string;
  suffix?: string;
  values?: any[];
  value?: any;
  min?: number;
  max?: number;
  exact?: number;
  pattern?: string;
  flags?: string;
  [key: string]: any;
}

export interface ValidationGroupDef {
  fields: string[];
  validators: Array<{ name: ValidatorName; config?: ValidatorConfig }>;
}
