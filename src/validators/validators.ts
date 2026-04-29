export interface ValidationResult {
  valid: boolean;
  error?: string;
  message?: string;
}

export interface ValidationOptions {
  [key: string]: any;
}

export type ValidationApplyContext = {
  stepId?: string;
  fieldName?: string;
};

function validationLocatorPrefix(context: ValidationApplyContext | undefined, validatorName: string): string {
  const parts: string[] = [];
  if (context?.stepId) parts.push(`step "${context.stepId}"`);
  if (context?.fieldName) parts.push(`field "${context.fieldName}"`);
  parts.push(`validator "${validatorName}"`);
  return `[${parts.join(" · ")}] `;
}

function enrichValidationText(
  context: ValidationApplyContext | undefined,
  validatorName: string,
  text: string | undefined,
  fallback: string
): string {
  const base = (text && String(text).trim()) || fallback;
  return validationLocatorPrefix(context, validatorName) + base;
}

export const ValidatorFns: Record<string, (v: any, options?: ValidationOptions) => ValidationResult> = {
  required: (v: any, options: ValidationOptions = {}): ValidationResult => {
    const { message } = options;
    if (v === null || v === undefined) {
      return { valid: false, error: message || "Value is required", message: message || "Value is required" };
    }
    if (typeof v === "string" && v.trim() === "") {
      return { valid: false, error: message || "Value cannot be empty", message: message || "Value cannot be empty" };
    }
    return { valid: true };
  },
  not_empty: (v: any, options: ValidationOptions = {}): ValidationResult => {
    const { message } = options;
    if (v === null || v === undefined) {
      return { valid: false, error: message || "Value is required", message: message || "Value cannot be empty" };
    }
    if (typeof v === "string" && v.trim() === "") {
      return { valid: false, error: message || "String cannot be empty", message: message || "String must not be empty" };
    }
    if (Array.isArray(v) && v.length === 0) {
      return { valid: false, error: message || "Array cannot be empty", message: message || "Array must contain at least one item" };
    }
    if (typeof v === "object" && !Array.isArray(v) && Object.keys(v).length === 0) {
      return { valid: false, error: message || "Object cannot be empty", message: message || "Object must contain at least one property" };
    }
    if (typeof v === "number" && isNaN(v)) {
      return { valid: false, error: message || "Number cannot be NaN", message: message || "Value must be a valid number" };
    }
    return { valid: true };
  },
  is_empty: (v: any, options: ValidationOptions = {}): ValidationResult => {
    const { message } = options;
    if (v === null || v === undefined) return { valid: true };
    if (typeof v === "string" && v.trim() === "") return { valid: true };
    if (Array.isArray(v) && v.length === 0) return { valid: true };
    if (typeof v === "object" && Object.keys(v).length === 0) return { valid: true };
    return { valid: false, error: message || "Value must be empty", message: message || "Value is not empty" };
  },
  contains: (v: any, options: ValidationOptions = {}): ValidationResult => {
    const { search, caseSensitive = false, message } = options;
    if (search === undefined || search === null) {
      return { valid: false, error: "Search value is required", message: "Search parameter is required for contains validation" };
    }
    if (typeof v !== "string") {
      return { valid: false, error: message || "Value must be a string", message: message || "Contains validation requires a string value" };
    }
    const value = caseSensitive ? v : v.toLowerCase();
    const searchStr = caseSensitive ? String(search) : String(search).toLowerCase();
    return value.includes(searchStr) ? { valid: true } : { valid: false, error: message || `String does not contain "${search}"`, message: message || `Value must contain "${search}"` };
  },
  not_contains: (v: any, options: ValidationOptions = {}): ValidationResult => {
    const { search, caseSensitive = false, message } = options;
    if (search === undefined || search === null) {
      return { valid: false, error: "Search value is required", message: "Search parameter is required for not_contains validation" };
    }
    if (typeof v !== "string") {
      return { valid: false, error: message || "Value must be a string", message: message || "Not contains validation requires a string value" };
    }
    const value = caseSensitive ? v : v.toLowerCase();
    const searchStr = caseSensitive ? String(search) : String(search).toLowerCase();
    return !value.includes(searchStr) ? { valid: true } : { valid: false, error: message || `String contains "${search}"`, message: message || `Value must not contain "${search}"` };
  },
  begins_with: (v: any, options: ValidationOptions = {}): ValidationResult => {
    const { prefix, caseSensitive = false, message } = options;
    if (prefix === undefined || prefix === null) {
      return { valid: false, error: "Prefix is required", message: "Prefix parameter is required for begins_with validation" };
    }
    if (typeof v !== "string") {
      return { valid: false, error: message || "Value must be a string", message: message || "Begins with validation requires a string value" };
    }
    const value = caseSensitive ? v : v.toLowerCase();
    const prefixStr = caseSensitive ? String(prefix) : String(prefix).toLowerCase();
    return value.startsWith(prefixStr) ? { valid: true } : { valid: false, error: message || `String does not begin with "${prefix}"`, message: message || `Value must begin with "${prefix}"` };
  },
  ends_with: (v: any, options: ValidationOptions = {}): ValidationResult => {
    const { suffix, caseSensitive = false, message } = options;
    if (suffix === undefined || suffix === null) {
      return { valid: false, error: "Suffix is required", message: "Suffix parameter is required for ends_with validation" };
    }
    if (typeof v !== "string") {
      return { valid: false, error: message || "Value must be a string", message: message || "Ends with validation requires a string value" };
    }
    const value = caseSensitive ? v : v.toLowerCase();
    const suffixStr = caseSensitive ? String(suffix) : String(suffix).toLowerCase();
    return value.endsWith(suffixStr) ? { valid: true } : { valid: false, error: message || `String does not end with "${suffix}"`, message: message || `Value must end with "${suffix}"` };
  },
  is_in: (v: any, options: ValidationOptions = {}): ValidationResult => {
    const { values, caseSensitive = false, message } = options;
    if (!Array.isArray(values) || values.length === 0) {
      return { valid: false, error: "Values must be an array", message: "Values parameter must be an array for is_in validation" };
    }
    let checkValue = v;
    let checkValues = values;
    if (!caseSensitive && typeof v === "string") {
      checkValue = v.toLowerCase();
      checkValues = values.map((val) => (typeof val === "string" ? val.toLowerCase() : val));
    }
    return checkValues.includes(checkValue) ? { valid: true } : { valid: false, error: message || "Value is not in allowed list", message: message || `Value must be one of: ${values.join(", ")}` };
  },
  not_in: (v: any, options: ValidationOptions = {}): ValidationResult => {
    const { values, caseSensitive = false, message } = options;
    if (!Array.isArray(values)) {
      return { valid: false, error: "Values must be an array", message: "Values parameter must be an array for not_in validation" };
    }
    let checkValue = v;
    let checkValues = values;
    if (!caseSensitive && typeof v === "string") {
      checkValue = v.toLowerCase();
      checkValues = values.map((val) => (typeof val === "string" ? val.toLowerCase() : val));
    }
    return !checkValues.includes(checkValue) ? { valid: true } : { valid: false, error: message || "Value is in disallowed list", message: message || `Value must not be one of: ${values.join(", ")}` };
  },
  is_email: (v: any, options: ValidationOptions = {}): ValidationResult => {
    const { message } = options;
    if (v === null || v === undefined || v === "") {
      return { valid: false, error: message || "Email is required", message: message || "Email cannot be empty" };
    }
    if (typeof v !== "string") {
      return { valid: false, error: message || "Email must be a string", message: message || "Email must be a valid string" };
    }
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? { valid: true } : { valid: false, error: message || "Invalid email format", message: message || "Value must be a valid email address" };
  },
  is_phone: (v: any, options: ValidationOptions = {}): ValidationResult => {
    const { pattern = "^\\+?[1-9]\\d{7,14}$", message } = options;
    if (v === null || v === undefined || v === "") {
      return { valid: false, error: message || "Phone number is required", message: message || "Phone number cannot be empty" };
    }
    if (typeof v !== "string") {
      return { valid: false, error: message || "Phone number must be a string", message: message || "Phone number must be a valid string" };
    }
    try {
      return new RegExp(pattern).test(v) ? { valid: true } : { valid: false, error: message || "Invalid phone number format", message: message || "Value must be a valid phone number" };
    } catch {
      return { valid: false, error: "Invalid regex pattern", message: "Phone validation pattern is invalid" };
    }
  },
  length: (v: any, options: ValidationOptions = {}): ValidationResult => {
    const { min, max, exact, message } = options;
    if (typeof v !== "string" && !Array.isArray(v)) {
      return { valid: false, error: message || "Value must be a string or array", message: message || "Length validation requires a string or array" };
    }
    const len = v.length;
    if (exact !== undefined) return len === exact ? { valid: true } : { valid: false, error: message || `Length must be exactly ${exact}`, message: message || `Value must have exactly ${exact} characters` };
    if (min !== undefined && len < min) return { valid: false, error: message || `Length must be at least ${min}`, message: message || `Value must have at least ${min} characters` };
    if (max !== undefined && len > max) return { valid: false, error: message || `Length must be at most ${max}`, message: message || `Value must have at most ${max} characters` };
    return { valid: true };
  },
  range: (v: any, options: ValidationOptions = {}): ValidationResult => {
    const { min, max, message } = options;
    if (typeof v !== "number" || isNaN(v)) {
      return { valid: false, error: message || "Value must be a number", message: message || "Range validation requires a numeric value" };
    }
    if (min !== undefined && v < min) return { valid: false, error: message || `Value must be at least ${min}`, message: message || `Value must be greater than or equal to ${min}` };
    if (max !== undefined && v > max) return { valid: false, error: message || `Value must be at most ${max}`, message: message || `Value must be less than or equal to ${max}` };
    return { valid: true };
  },
  matches: (v: any, options: ValidationOptions = {}): ValidationResult => {
    const { pattern, flags = "", message } = options;
    if (pattern === undefined || pattern === null) {
      return { valid: false, error: "Pattern is required", message: "Pattern parameter is required for matches validation" };
    }
    if (typeof v !== "string") {
      return { valid: false, error: message || "Value must be a string", message: message || "Matches validation requires a string value" };
    }
    try {
      return new RegExp(pattern, flags).test(v) ? { valid: true } : { valid: false, error: message || "Value does not match pattern", message: message || `Value must match pattern: ${pattern}` };
    } catch {
      return { valid: false, error: "Invalid regex pattern", message: "Pattern is not a valid regular expression" };
    }
  },
  is_number: (v: any, options: ValidationOptions = {}): ValidationResult => {
    const { message } = options;
    return typeof v === "number" && !isNaN(v) ? { valid: true } : { valid: false, error: message || "Value must be a number", message: message || "Value must be a valid number" };
  },
  is_string: (v: any, options: ValidationOptions = {}): ValidationResult => {
    const { message } = options;
    return typeof v === "string" ? { valid: true } : { valid: false, error: message || "Value must be a string", message: message || "Value must be a valid string" };
  },
  is_boolean: (v: any, options: ValidationOptions = {}): ValidationResult => {
    const { message } = options;
    return typeof v === "boolean" ? { valid: true } : { valid: false, error: message || "Value must be a boolean", message: message || "Value must be true or false" };
  },
  is_array: (v: any, options: ValidationOptions = {}): ValidationResult => {
    const { message } = options;
    return Array.isArray(v) ? { valid: true } : { valid: false, error: message || "Value must be an array", message: message || "Value must be a valid array" };
  },
  is_object: (v: any, options: ValidationOptions = {}): ValidationResult => {
    const { message } = options;
    return typeof v === "object" && v !== null && !Array.isArray(v) ? { valid: true } : { valid: false, error: message || "Value must be an object", message: message || "Value must be a valid object" };
  },
  equals: (v: any, options: ValidationOptions = {}): ValidationResult => {
    const { value, message } = options;
    if (value === undefined) return { valid: false, error: "Comparison value is required", message: "Value parameter is required for equals validation" };
    return v === value ? { valid: true } : { valid: false, error: message || `Value does not equal ${value}`, message: message || `Value must equal ${value}` };
  },
  not_equals: (v: any, options: ValidationOptions = {}): ValidationResult => {
    const { value, message } = options;
    if (value === undefined) return { valid: false, error: "Comparison value is required", message: "Value parameter is required for not_equals validation" };
    return v !== value ? { valid: true } : { valid: false, error: message || `Value must not equal ${value}`, message: message || `Value must not be equal to ${value}` };
  },
  greater_than: (v: any, options: ValidationOptions = {}): ValidationResult => {
    const { value, message } = options;
    if (value === undefined) return { valid: false, error: "Comparison value is required", message: "Value parameter is required for greater_than validation" };
    if (typeof v !== "number" || isNaN(v)) return { valid: false, error: message || "Value must be a number", message: message || "Greater than validation requires a numeric value" };
    return v > value ? { valid: true } : { valid: false, error: message || `Value must be greater than ${value}`, message: message || `Value must be greater than ${value}` };
  },
  greater_than_or_equal: (v: any, options: ValidationOptions = {}): ValidationResult => {
    const { value, message } = options;
    if (value === undefined) return { valid: false, error: "Comparison value is required", message: "Value parameter is required for greater_than_or_equal validation" };
    if (typeof v !== "number" || isNaN(v)) return { valid: false, error: message || "Value must be a number", message: message || "Greater than or equal validation requires a numeric value" };
    return v >= value ? { valid: true } : { valid: false, error: message || `Value must be greater than or equal to ${value}`, message: message || `Value must be greater than or equal to ${value}` };
  },
  less_than: (v: any, options: ValidationOptions = {}): ValidationResult => {
    const { value, message } = options;
    if (value === undefined) return { valid: false, error: "Comparison value is required", message: "Value parameter is required for less_than validation" };
    if (typeof v !== "number" || isNaN(v)) return { valid: false, error: message || "Value must be a number", message: message || "Less than validation requires a numeric value" };
    return v < value ? { valid: true } : { valid: false, error: message || `Value must be less than ${value}`, message: message || `Value must be less than ${value}` };
  },
  less_than_or_equal: (v: any, options: ValidationOptions = {}): ValidationResult => {
    const { value, message } = options;
    if (value === undefined) return { valid: false, error: "Comparison value is required", message: "Value parameter is required for less_than_or_equal validation" };
    if (typeof v !== "number" || isNaN(v)) return { valid: false, error: message || "Value must be a number", message: message || "Less than or equal validation requires a numeric value" };
    return v <= value ? { valid: true } : { valid: false, error: message || `Value must be less than or equal to ${value}`, message: message || `Value must be less than or equal to ${value}` };
  },
  is_url: (v: any, options: ValidationOptions = {}): ValidationResult => {
    const { message } = options;
    if (v === null || v === undefined || v === "") return { valid: false, error: message || "URL is required", message: message || "URL cannot be empty" };
    if (typeof v !== "string") return { valid: false, error: message || "URL must be a string", message: message || "URL must be a valid string" };
    try {
      new URL(v);
      return { valid: true };
    } catch {
      return { valid: false, error: message || "Invalid URL format", message: message || "Value must be a valid URL" };
    }
  },
  is_date: (v: any, options: ValidationOptions = {}): ValidationResult => {
    const { message } = options;
    if (v === null || v === undefined || v === "") return { valid: false, error: message || "Date is required", message: message || "Date cannot be empty" };
    const date = new Date(v);
    return isNaN(date.getTime()) ? { valid: false, error: message || "Invalid date format", message: message || "Value must be a valid date" } : { valid: true };
  },
  is_address: (v: any, options: ValidationOptions = {}): ValidationResult => {
    const { minLength = 5, maxLength, message } = options;
    if (v === null || v === undefined || v === "") return { valid: false, error: message || "Address is required", message: message || "Address cannot be empty" };
    if (typeof v !== "string") return { valid: false, error: message || "Address must be a string", message: message || "Address must be a valid string" };
    const trimmed = v.trim();
    if (trimmed.length < minLength) return { valid: false, error: message || `Address must be at least ${minLength} characters`, message: message || `Address must be at least ${minLength} characters long` };
    if (maxLength !== undefined && trimmed.length > maxLength) return { valid: false, error: message || `Address must be at most ${maxLength} characters`, message: message || `Address must be at most ${maxLength} characters long` };
    return { valid: true };
  },
  is_uuid: (v: any, options: ValidationOptions = {}): ValidationResult => {
    const { message } = options;
    const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return typeof v === "string" && regex.test(v) ? { valid: true } : { valid: false, error: message || "Invalid UUID format", message: message || "Value must be a valid UUID" };
  },
  is_cuid: (v: any, options: ValidationOptions = {}): ValidationResult => {
    const { message } = options;
    const regex = /^c[^\s-]{8,}$/i;
    return typeof v === "string" && regex.test(v) ? { valid: true } : { valid: false, error: message || "Invalid CUID format", message: message || "Value must be a valid CUID" };
  },
  is_jwt: (v: any, options: ValidationOptions = {}): ValidationResult => {
    const { message } = options;
    const regex = /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/;
    return typeof v === "string" && regex.test(v) ? { valid: true } : { valid: false, error: message || "Invalid JWT format", message: message || "Value must be a valid JWT" };
  },
  is_json: (v: any, options: ValidationOptions = {}): ValidationResult => {
    const { message } = options;
    if (typeof v !== "string") return { valid: false, error: message || "Value must be a string", message: message || "JSON validation requires a string" };
    try {
      JSON.parse(v);
      return { valid: true };
    } catch {
      return { valid: false, error: message || "Invalid JSON format", message: message || "Value must be valid JSON" };
    }
  },
  is_alphanumeric: (v: any, options: ValidationOptions = {}): ValidationResult => {
    const { message } = options;
    return typeof v === "string" && /^[a-zA-Z0-9]+$/.test(v) ? { valid: true } : { valid: false, error: message || "Must be alphanumeric", message: message || "Value must contain only letters and numbers" };
  },
  is_alpha: (v: any, options: ValidationOptions = {}): ValidationResult => {
    const { message } = options;
    return typeof v === "string" && /^[a-zA-Z]+$/.test(v) ? { valid: true } : { valid: false, error: message || "Must contain only letters", message: message || "Value must contain only letters" };
  },
  is_numeric_string: (v: any, options: ValidationOptions = {}): ValidationResult => {
    const { message } = options;
    return typeof v === "string" && /^[0-9]+$/.test(v) ? { valid: true } : { valid: false, error: message || "Must contain only numbers", message: message || "Value must contain only numbers" };
  },
  is_hex_color: (v: any, options: ValidationOptions = {}): ValidationResult => {
    const { message } = options;
    return typeof v === "string" && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v) ? { valid: true } : { valid: false, error: message || "Invalid hex color", message: message || "Value must be a valid hex color" };
  },
  is_base64: (v: any, options: ValidationOptions = {}): ValidationResult => {
    const { message } = options;
    const regex = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
    return typeof v === "string" && regex.test(v) ? { valid: true } : { valid: false, error: message || "Invalid base64 string", message: message || "Value must be base64 encoded" };
  },
  is_credit_card: (v: any, options: ValidationOptions = {}): ValidationResult => {
    const { message } = options;
    if (typeof v !== "string") return { valid: false, error: message || "Credit card must be a string", message: message || "Value must be a string" };
    const sanitized = v.replace(/[- ]/g, "");
    if (!/^\d{13,19}$/.test(sanitized)) return { valid: false, error: message || "Invalid credit card format", message: message || "Invalid credit card format" };
    let sum = 0;
    let alternate = false;
    for (let i = sanitized.length - 1; i >= 0; i--) {
      let n = parseInt(sanitized.charAt(i), 10);
      if (alternate) {
        n *= 2;
        if (n > 9) n = (n % 10) + 1;
      }
      sum += n;
      alternate = !alternate;
    }
    return sum % 10 === 0 ? { valid: true } : { valid: false, error: message || "Invalid credit card number", message: message || "Value must be a valid credit card" };
  },
  is_lowercase: (v: any, options: ValidationOptions = {}): ValidationResult => {
    const { message } = options;
    return typeof v === "string" && v === v.toLowerCase() ? { valid: true } : { valid: false, error: message || "Must be lowercase", message: message || "Value must be lowercase" };
  },
  is_uppercase: (v: any, options: ValidationOptions = {}): ValidationResult => {
    const { message } = options;
    return typeof v === "string" && v === v.toUpperCase() ? { valid: true } : { valid: false, error: message || "Must be uppercase", message: message || "Value must be uppercase" };
  },
  is_slug: (v: any, options: ValidationOptions = {}): ValidationResult => {
    const { message } = options;
    return typeof v === "string" && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(v) ? { valid: true } : { valid: false, error: message || "Invalid slug format", message: message || "Value must be a valid slug" };
  },
  is_mac_address: (v: any, options: ValidationOptions = {}): ValidationResult => {
    const { message } = options;
    const regex = /^([0-9a-fA-F]{2}[:-]){5}([0-9a-fA-F]{2})$/;
    return typeof v === "string" && regex.test(v) ? { valid: true } : { valid: false, error: message || "Invalid MAC address", message: message || "Value must be a valid MAC address" };
  },
  is_port: (v: any, options: ValidationOptions = {}): ValidationResult => {
    const { message } = options;
    const port = typeof v === "string" ? parseInt(v, 10) : v;
    return typeof port === "number" && port >= 0 && port <= 65535 ? { valid: true } : { valid: false, error: message || "Invalid port number", message: message || "Port must be between 0 and 65535" };
  },
  is_currency: (v: any, options: ValidationOptions = {}): ValidationResult => {
    const { message } = options;
    const regex = /^(?!0\.00)\d{1,3}(,\d{3})*(\.\d\d)?$/;
    let checkValue = typeof v === "number" ? v.toString() : v;
    if (typeof checkValue === "string" && checkValue.startsWith("$")) checkValue = checkValue.substring(1);
    return typeof checkValue === "string" && regex.test(checkValue) ? { valid: true } : { valid: false, error: message || "Invalid currency format", message: message || "Value must be a valid currency amount" };
  },
  is_latitude: (v: any, options: ValidationOptions = {}): ValidationResult => {
    const { message } = options;
    const val = typeof v === "string" ? parseFloat(v) : v;
    return typeof val === "number" && val >= -90 && val <= 90 ? { valid: true } : { valid: false, error: message || "Invalid latitude", message: message || "Latitude must be between -90 and 90" };
  },
  is_longitude: (v: any, options: ValidationOptions = {}): ValidationResult => {
    const { message } = options;
    const val = typeof v === "string" ? parseFloat(v) : v;
    return typeof val === "number" && val >= -180 && val <= 180 ? { valid: true } : { valid: false, error: message || "Invalid longitude", message: message || "Longitude must be between -180 and 180" };
  },
  is_ip: (v: any, options: ValidationOptions = {}): ValidationResult => {
    const { version, message } = options;
    if (typeof v !== "string") return { valid: false, error: message || "IP must be a string", message: message || "Value must be a string" };
    const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    const ipv6Regex = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/;
    if (version === 4) return ipv4Regex.test(v) ? { valid: true } : { valid: false, error: message || "Invalid IPv4 address", message: message || "Value must be a valid IPv4 address" };
    if (version === 6) return ipv6Regex.test(v) ? { valid: true } : { valid: false, error: message || "Invalid IPv6 address", message: message || "Value must be a valid IPv6 address" };
    return ipv4Regex.test(v) || ipv6Regex.test(v) ? { valid: true } : { valid: false, error: message || "Invalid IP address", message: message || "Value must be a valid IP address" };
  },
  is_strong_password: (v: any, options: ValidationOptions = {}): ValidationResult => {
    const { minLength = 8, minLowercase = 1, minUppercase = 1, minNumbers = 1, minSymbols = 1, message } = options;
    if (typeof v !== "string") return { valid: false, error: message || "Password must be a string", message: message || "Value must be a string" };
    if (v.length < minLength) return { valid: false, error: message || `Password must be at least ${minLength} characters`, message: message || `Password must be at least ${minLength} characters long` };
    const lowercaseCount = (v.match(/[a-z]/g) || []).length;
    if (lowercaseCount < minLowercase) return { valid: false, error: message || `Password needs ${minLowercase} lowercase letter(s)`, message: message || `Password needs at least ${minLowercase} lowercase letter(s)` };
    const uppercaseCount = (v.match(/[A-Z]/g) || []).length;
    if (uppercaseCount < minUppercase) return { valid: false, error: message || `Password needs ${minUppercase} uppercase letter(s)`, message: message || `Password needs at least ${minUppercase} uppercase letter(s)` };
    const numberCount = (v.match(/[0-9]/g) || []).length;
    if (numberCount < minNumbers) return { valid: false, error: message || `Password needs ${minNumbers} number(s)`, message: message || `Password needs at least ${minNumbers} number(s)` };
    const symbolCount = (v.match(/[^a-zA-Z0-9]/g) || []).length;
    if (symbolCount < minSymbols) return { valid: false, error: message || `Password needs ${minSymbols} symbol(s)`, message: message || `Password needs at least ${minSymbols} symbol(s)` };
    return { valid: true };
  },
};

export function applyValidations(
  validations: Array<{ validator: string; options?: ValidationOptions }>,
  value: any,
  context?: ValidationApplyContext
): ValidationResult {
  for (const validation of validations) {
    const { validator, options = {} } = validation;
    const validatorFn = ValidatorFns[validator];
    if (!validatorFn) {
      const hint = validationLocatorPrefix(context, validator);
      throw new Error(`${hint}Unknown validator "${validator}"`);
    }
    const result = validatorFn(value, options);
    if (!result.valid) {
      return {
        ...result,
        valid: false,
        error: enrichValidationText(context, validator, result.error, result.message || "Validation failed"),
        message: enrichValidationText(context, validator, result.message, result.error || "Validation failed"),
      };
    }
  }
  return { valid: true };
}
