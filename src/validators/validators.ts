export interface ValidationResult {
  valid: boolean;
  error?: string;
  message?: string;
}

export interface ValidationOptions {
  [key: string]: any;
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
};

export function applyValidations(
  validations: Array<{ validator: string; options?: ValidationOptions }>,
  value: any
): ValidationResult {
  for (const validation of validations) {
    const { validator, options = {} } = validation;
    const validatorFn = ValidatorFns[validator];
    if (!validatorFn) {
      return { valid: false, error: `Unknown validator: ${validator}`, message: `Validator "${validator}" is not recognized` };
    }
    const result = validatorFn(value, options);
    if (!result.valid) return result;
  }
  return { valid: true };
}
