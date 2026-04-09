import type { ConnectorStepConfig } from "../decorators/metadata";

export const ConnectorId = {
  Database: {
    MongoDB: "mongodb.system",
    MySQL: "mysql.system",
    PostgreSQL: "postgres.system",
    Redis: "redis.system",
  },
  Auth: {
    Bearer: "bearer.system",
    ApiKey: "api_key.system",
    Basic: "basic.system",
    CustomHeader: "custom_header.system",
  },
  Utility: {
    DateTime: "utility.date_time",
    String: "utility.string",
    Random: "utility.random",
    Math: "utility.math",
    Compare: "utility.compare",
    Geo: "utility.geo",
  },
  Encryption: {
    Base64: "base64.encryption",
    Hash: "hash.encryption",
    AES: "aes.encryption",
    RSA: "rsa.encryption",
    HMAC: "hmac.encryption",
    Password: "password.encryption",
  },
  Responder: {
    Json: "json.responder",
  },
  Condition: {
    Logic: "condition.logic",
  },
  Cliodot: "cliodot",
} as const;

export const ConnectorActions = {
  [ConnectorId.Database.MongoDB]: {
    insertOne: "insertOne",
    insertMany: "insertMany",
    findOne: "findOne",
    find: "find",
    updateOne: "updateOne",
    deleteOne: "deleteOne",
  },
  [ConnectorId.Database.MySQL]: {
    query: "query",
  },
  [ConnectorId.Database.PostgreSQL]: {
    query: "query",
  },
  [ConnectorId.Database.Redis]: {
    get: "redis.get",
    set: "redis.set",
    delete: "redis.delete",
    hset: "redis.hset",
    hget: "redis.hget",
    lpush: "redis.lpush",
    lpop: "redis.lpop",
    zadd: "redis.zadd",
    create_hash: "redis.create_hash",
    delete_key: "redis.delete_key",
  },
  [ConnectorId.Auth.Bearer]: {
    bearer_create: "bearer.create",
    bearer_validate: "bearer.validate",
    create: "create",
    validate: "validate",
  },
  [ConnectorId.Auth.ApiKey]: {
    api_key_create: "api_key.create",
    api_key_validate: "api_key.validate",
    create: "create",
    validate: "validate",
  },
  [ConnectorId.Auth.Basic]: {
    basic_create: "basic.create",
    basic_validate: "basic.validate",
    create: "create",
    validate: "validate",
  },
  [ConnectorId.Auth.CustomHeader]: {
    custom_header_create: "custom_header.create",
    custom_header_validate: "custom_header.validate",
    create: "create",
    validate: "validate",
  },
  [ConnectorId.Utility.DateTime]: {
    get_current_date: "get_current_date",
    get_current_time: "get_current_time",
    get_current_datetime: "get_current_datetime",
    format: "format",
    format_date: "format_date",
    parse_date: "parse_date",
    add_time: "add_time",
    subtract_time: "subtract_time",
    diff_between_dates: "diff_between_dates",
    start_of_day: "start_of_day",
    end_of_day: "end_of_day",
    start_of_week: "start_of_week",
    end_of_week: "end_of_week",
    start_of_month: "start_of_month",
    end_of_month: "end_of_month",
    start_of_year: "start_of_year",
    end_of_year: "end_of_year",
    convert_timezone: "convert_timezone",
    get_timezone: "get_timezone",
    list_timezones: "list_timezones",
    is_leap_year: "is_leap_year",
    get_unix_timestamp: "get_unix_timestamp",
    from_unix_timestamp: "from_unix_timestamp",
  },
  [ConnectorId.Utility.String]: {
    concat: "concat", split: "split", join: "join", replace: "replace", replace_all: "replace_all", trim: "trim", trim_start: "trim_start", trim_end: "trim_end",
    to_uppercase: "to_uppercase", to_lowercase: "to_lowercase", capitalize: "capitalize", substring: "substring", length: "length", contains: "contains", starts_with: "starts_with", ends_with: "ends_with",
    remove_whitespace: "remove_whitespace", slugify: "slugify", pad_start: "pad_start", pad_end: "pad_end", reverse: "reverse", encode_base64: "encode_base64", decode_base64: "decode_base64",
    encode_uri: "encode_uri", decode_uri: "decode_uri", after: "after", after_last: "after_last", before: "before", before_last: "before_last", between: "between", between_first: "between_first",
    camel: "camel", char_at: "char_at", chop_start: "chop_start", chop_end: "chop_end", contains_all: "contains_all", doesnt_contain: "doesnt_contain", doesnt_start_with: "doesnt_start_with", doesnt_end_with: "doesnt_end_with",
    deduplicate: "deduplicate", excerpt: "excerpt", finish: "finish", start: "start", headline: "headline", is: "is", is_ascii: "is_ascii", is_json: "is_json", is_ulid: "is_ulid", is_url: "is_url", is_uuid: "is_uuid", is_empty: "is_empty", is_match: "is_match",
    kebab: "kebab", snake: "snake", studly: "studly", title: "title", lcfirst: "lcfirst", ucfirst: "ucfirst", ucwords: "ucwords", ucsplit: "ucsplit", limit: "limit", mask: "mask", match: "match", match_all: "match_all",
    pad_both: "pad_both", plural: "plural", singular: "singular", position: "position", random: "random", remove: "remove", repeat: "repeat", replace_array: "replace_array", replace_first: "replace_first", replace_last: "replace_last",
    replace_matches: "replace_matches", replace_start: "replace_start", replace_end: "replace_end", squish: "squish", substr: "substr", substr_count: "substr_count", substr_replace: "substr_replace", swap: "swap", take: "take",
    word_count: "word_count", word_wrap: "word_wrap", words: "words", wrap: "wrap", unwrap: "unwrap", uuid: "uuid", ulid: "ulid", strip_tags: "strip_tags", ascii: "ascii", apa: "apa", class_basename: "class_basename",
  },
  [ConnectorId.Utility.Random]: {
    random_int: "random_int", random_float: "random_float", random_string: "random_string", random_uuid: "random_uuid", uuid: "uuid", random_boolean: "random_boolean", random_choice: "random_choice",
    random_password: "random_password", random_hex: "random_hex", random_alphanumeric: "random_alphanumeric", random_date: "random_date", random_color: "random_color", shuffle_array: "shuffle_array",
  },
  [ConnectorId.Utility.Math]: {
    add: "add", subtract: "subtract", multiply: "multiply", divide: "divide", modulo: "modulo", power: "power", round: "round", floor: "floor", ceil: "ceil",
    abs: "abs", min: "min", max: "max", average: "average", sum: "sum", clamp: "clamp", random_between: "random_between", percentage: "percentage", percentage_of: "percentage_of", sqrt: "sqrt", log: "log",
  },
  [ConnectorId.Utility.Compare]: {
    diff_objects: "diff_objects",
    diff_arrays: "diff_arrays",
    compare_strings: "compare_strings",
    compare_numbers: "compare_numbers",
    compare_dates: "compare_dates",
    is_changed: "is_changed",
    is_equal: "is_equal",
    is_not_equal: "is_not_equal",
    is_greater_than: "is_greater_than",
    is_less_than: "is_less_than",
    is_between: "is_between",
    is_empty: "is_empty",
    is_null_or_undefined: "is_null_or_undefined",
    is_same_type: "is_same_type",
    deep_equal: "deep_equal",
    shallow_equal: "shallow_equal",
    similarity_score: "similarity_score",
    array_intersection: "array_intersection",
    array_union: "array_union",
    array_difference: "array_difference",
  },
  [ConnectorId.Utility.Geo]: {
    calculate_distance: "calculate_distance",
    point_in_polygon: "point_in_polygon",
    get_bounding_box: "get_bounding_box",
    reverse_geocode: "reverse_geocode",
    geocode: "geocode",
    convert_coordinates: "convert_coordinates",
  },
  [ConnectorId.Encryption.Base64]: {
    encode: "base64.encode",
    decode: "base64.decode",
  },
  [ConnectorId.Encryption.Hash]: {
    hash: "hash",
    md5: "hash.md5",
    sha1: "hash.sha1",
    sha256: "hash.sha256",
    sha512: "hash.sha512",
  },
  [ConnectorId.Encryption.AES]: {
    encrypt: "aes.encrypt",
    decrypt: "aes.decrypt",
    generate_key: "aes.generate_key",
    generate_iv: "aes.generate_iv",
  },
  [ConnectorId.Encryption.RSA]: {
    generate_keypair: "rsa.generate_keypair",
    encrypt: "rsa.encrypt",
    decrypt: "rsa.decrypt",
    sign: "rsa.sign",
    verify: "rsa.verify",
  },
  [ConnectorId.Encryption.HMAC]: {
    create: "hmac.create",
    verify: "hmac.verify",
  },
  [ConnectorId.Encryption.Password]: {
    argon2_hash: "password.argon2_hash",
    argon2_verify: "password.argon2_verify",
    pbkdf2_hash: "password.pbkdf2_hash",
    pbkdf2_verify: "password.pbkdf2_verify",
    scrypt_hash: "password.scrypt_hash",
    scrypt_verify: "password.scrypt_verify",
    bcrypt_hash: "password.bcrypt_hash",
    bcrypt_verify: "password.bcrypt_verify",
    generate_salt: "password.generate_salt",
  },
} as const;

export type BuiltInConnectorId =
  | (typeof ConnectorId.Database)[keyof typeof ConnectorId.Database]
  | (typeof ConnectorId.Auth)[keyof typeof ConnectorId.Auth]
  | (typeof ConnectorId.Utility)[keyof typeof ConnectorId.Utility]
  | (typeof ConnectorId.Encryption)[keyof typeof ConnectorId.Encryption]
  | (typeof ConnectorId.Responder)[keyof typeof ConnectorId.Responder]
  | (typeof ConnectorId.Condition)[keyof typeof ConnectorId.Condition]
  | typeof ConnectorId.Cliodot;

export interface CustomConnectorDef<TActions extends Record<string, string> = Record<string, string>> {
  id: string;
  actions: TActions;
}

export function defineCustomConnector<TActions extends Record<string, string>>(
  id: string,
  actions: TActions
): CustomConnectorDef<TActions> {
  return { id, actions };
}

export function defineCustomConnectorFromList(
  id: string,
  actionList: readonly string[]
): CustomConnectorDef<Record<string, string>> {
  const actions = Object.fromEntries(actionList.map((a) => [a, a]));
  return { id, actions };
}

// ─── Typed Connector Definitions ──────────────────────────────────────────────

export type WireValue<T> = T extends string | number | boolean | null | undefined
  ? T | string
  : T extends ReadonlyArray<infer U>
    ? ReadonlyArray<WireValue<U>> | string
    : T extends Record<string, any>
      ? WireRecord<T> | string
      : T | string;

export type WireRecord<T extends Record<string, any>> = {
  [K in keyof T]?: WireValue<T[K]>;
};

export interface ConnectorActionSchema<
  TBody = any,
  TParams = Record<string, any>,
  TPathParams = Record<string, any>,
  TResponse = any,
  THeaders = Record<string, unknown>,
  TVars = Record<string, unknown>,
> {
  body?: TBody;
  params?: TParams;
  pathParams?: TPathParams;
  response?: TResponse;
  headers?: THeaders;
  vars?: TVars;
}

type SchemaWire<T> = unknown extends T
  ? ConnectorStepConfig[keyof Pick<ConnectorStepConfig, "body" | "params" | "pathParams">]
  : T extends Record<string, any>
    ? WireRecord<T>
    : T extends ReadonlyArray<unknown>
      ? WireValue<T>
      : WireValue<T>;

type RequestPartsFromSchema<S> = S extends ConnectorActionSchema<
  infer B,
  infer P,
  infer PP,
  infer _R,
  infer H,
  infer V
>
  ? {
      body?: SchemaWire<B>;
      params?: SchemaWire<P>;
      pathParams?: SchemaWire<PP>;
      headers?: SchemaWire<H> | ConnectorStepConfig["headers"];
      vars?: SchemaWire<V>;
    }
  : {};

/**
 * A map of action names → their schemas.
 *
 * ```ts
 * type PaystackActions = {
 *   initializeTransaction: ConnectorActionSchema<
 *     { email: string; amount: number; reference?: string },
 *     Record<string, never>,
 *     Record<string, never>,
 *     { authorization_url: string; access_code: string; reference: string },
 *     Record<string, never>,
 *     Record<string, never>
 *   >;
 *   verifyTransaction: ConnectorActionSchema<
 *     Record<string, never>,
 *     Record<string, never>,
 *     { reference: string },
 *     { status: string; amount: number }
 *   >;
 * };
 * ```
 */
export type ConnectorActionSchemaMap = Record<string, ConnectorActionSchema>;

/**
 * A typed connector definition with full action payload/response types.
 *
 * - `id` — the connector ID string
 * - `actions` — map of action names (typed strings)
 * - `Action<K>` — helper type to extract the schema for a specific action
 */
export interface TypedConnectorDef<
  TActions extends Record<string, string>,
  TSchemas extends Record<string, ConnectorActionSchema> = Record<string, ConnectorActionSchema>,
> extends CustomConnectorDef<TActions> {
  /**
   * Type-level helper: extract payload/response types for a given action.
   * Not a runtime value — use with `typeof` in type positions.
   */
  readonly __schemas: TSchemas;
}

/**
 * Extracts the body type for a given action from a TypedConnectorDef.
 */
export type ConnectorBody<
  TDef extends TypedConnectorDef<any, any>,
  TAction extends keyof TDef["__schemas"],
> = TDef["__schemas"][TAction] extends ConnectorActionSchema<infer B, any, any, any, any, any> ? B : any;

export type ConnectorParams<
  TDef extends TypedConnectorDef<any, any>,
  TAction extends keyof TDef["__schemas"],
> = TDef["__schemas"][TAction] extends ConnectorActionSchema<any, infer P, any, any, any, any>
  ? P
  : Record<string, any>;

export type ConnectorPathParams<
  TDef extends TypedConnectorDef<any, any>,
  TAction extends keyof TDef["__schemas"],
> = TDef["__schemas"][TAction] extends ConnectorActionSchema<any, any, infer PP, any, any, any>
  ? PP
  : Record<string, any>;

export type ConnectorResponse<
  TDef extends TypedConnectorDef<any, any>,
  TAction extends keyof TDef["__schemas"],
> = TDef["__schemas"][TAction] extends ConnectorActionSchema<any, any, any, infer R, any, any> ? R : any;

export type ConnectorHeaders<
  TDef extends TypedConnectorDef<any, any>,
  TAction extends keyof TDef["__schemas"],
> = TDef["__schemas"][TAction] extends ConnectorActionSchema<any, any, any, any, infer H, any>
  ? H
  : Record<string, unknown>;

export type ConnectorVars<
  TDef extends TypedConnectorDef<any, any>,
  TAction extends keyof TDef["__schemas"],
> = TDef["__schemas"][TAction] extends ConnectorActionSchema<any, any, any, any, any, infer V>
  ? V
  : Record<string, unknown>;

export type ConnectorTypedRequestConfig<
  TDef extends TypedConnectorDef<any, any>,
  TKey extends keyof TDef["actions"],
> = Omit<ConnectorStepConfig, "body" | "params" | "pathParams" | "headers" | "vars"> &
  (TKey extends keyof TDef["__schemas"]
    ? RequestPartsFromSchema<TDef["__schemas"][TKey]>
    : Pick<ConnectorStepConfig, "body" | "params" | "pathParams" | "headers" | "vars">);

export type ConnectorRunOptionsTyped<
  TDef extends TypedConnectorDef<any, any>,
  TKey extends keyof TDef["actions"],
> = ConnectorTypedRequestConfig<TDef, TKey>;

export type ConnectorActionRequest<
  TDef extends TypedConnectorDef<any, any>,
  TKey extends keyof TDef["__schemas"],
> = TDef["__schemas"][TKey] extends ConnectorActionSchema<infer B, infer P, infer PP, infer _R, infer H, infer V>
  ? {
      body?: B;
      params?: P;
      pathParams?: PP;
      headers?: H;
      vars?: V;
    }
  : never;

export function isTypedConnectorDef(v: unknown): v is TypedConnectorDef<any, any> {
  return (
    typeof v === "object" &&
    v !== null &&
    "__schemas" in v &&
    "id" in v &&
    "actions" in v &&
    typeof (v as TypedConnectorDef<any, any>).id === "string"
  );
}

export function isCustomConnectorDef(v: unknown): v is CustomConnectorDef<any> {
  return (
    typeof v === "object" &&
    v !== null &&
    "id" in v &&
    "actions" in v &&
    typeof (v as CustomConnectorDef<any>).id === "string" &&
    typeof (v as CustomConnectorDef<any>).actions === "object"
  );
}

/**
 * Define a connector with fully typed actions, payloads, and responses.
 * Use this for remote connectors where you don't have the implementation locally
 * but want full type safety when building workflows.
 *
 * @example
 * ```ts
 * const Paystack = defineTypedConnector("paystack", {
 *   initializeTransaction: "Initialize Transaction",
 *   verifyTransaction: "Verify Transaction",
 *   listTransactions: "List Transactions",
 * }, {
 *   initializeTransaction: {
 *     body: {} as { email: string; amount: number; reference?: string },
 *     response: {} as { authorization_url: string; access_code: string; reference: string },
 *   },
 *   verifyTransaction: {
 *     pathParams: {} as { reference: string },
 *     response: {} as { status: string; amount: number; currency: string },
 *   },
 *   listTransactions: {
 *     params: {} as { page?: number; perPage?: number; status?: string },
 *     response: {} as { data: Array<{ reference: string; amount: number }> },
 *   },
 * });
 *
 * // Full type safety:
 * type InitBody = ConnectorBody<typeof Paystack, "initializeTransaction">;
 * // => { email: string; amount: number; reference?: string }
 *
 * type VerifyResponse = ConnectorResponse<typeof Paystack, "verifyTransaction">;
 * // => { status: string; amount: number; currency: string }
 * ```
 */
export function defineTypedConnector<
  TActions extends Record<string, string>,
  TSchemas extends Partial<Record<keyof TActions, ConnectorActionSchema>>,
>(
  id: string,
  actions: TActions,
  schemas: TSchemas
): TypedConnectorDef<TActions, TSchemas & Record<string, ConnectorActionSchema>> {
  return {
    id,
    actions,
    __schemas: schemas as TSchemas & Record<string, ConnectorActionSchema>,
  };
}

export function getConnectorActions(connectorId: string): readonly string[] {
  const actions = ConnectorActions[connectorId as keyof typeof ConnectorActions];
  if (!actions) return [];
  return Object.values(actions) as string[];
}

export function listBuiltInConnectors(): Array<{
  id: string;
  category: string;
  actions: readonly string[];
}> {
  const result: Array<{ id: string; category: string; actions: readonly string[] }> = [];
  for (const [id, actionsObj] of Object.entries(ConnectorActions)) {
    result.push({
      id,
      category: id.includes(".") ? id.split(".")[0] : "custom",
      actions: Object.values(actionsObj) as string[],
    });
  }
  return result;
}
