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
  [ConnectorId.Database.MongoDB]: [
    "insertOne",
    "insertMany",
    "findOne",
    "find",
    "updateOne",
    "deleteOne",
  ] as const,
  [ConnectorId.Database.MySQL]: ["query"] as const,
  [ConnectorId.Database.PostgreSQL]: ["query"] as const,
  [ConnectorId.Database.Redis]: ["redis.get", "redis.set", "redis.delete", "redis.hset", "redis.hget", "redis.lpush", "redis.lpop", "redis.zadd", "redis.create_hash", "redis.delete_key"] as const,
  [ConnectorId.Auth.Bearer]: ["bearer.validate", "validate"] as const,
  [ConnectorId.Auth.ApiKey]: ["api_key.validate", "validate"] as const,
  [ConnectorId.Utility.DateTime]: [
    "get_current_date",
    "get_current_time",
    "get_current_datetime",
    "format",
    "format_date",
    "parse_date",
    "add_time",
    "subtract_time",
    "diff_between_dates",
    "start_of_day",
    "end_of_day",
    "start_of_week",
    "end_of_week",
    "start_of_month",
    "end_of_month",
    "start_of_year",
    "end_of_year",
    "convert_timezone",
    "get_timezone",
    "list_timezones",
    "is_leap_year",
    "get_unix_timestamp",
    "from_unix_timestamp",
  ] as const,
  [ConnectorId.Utility.String]: [
    "concat", "split", "join", "replace", "replace_all", "trim", "trim_start", "trim_end",
    "to_uppercase", "to_lowercase", "capitalize", "substring", "length", "contains", "starts_with", "ends_with",
    "remove_whitespace", "slugify", "pad_start", "pad_end", "reverse", "encode_base64", "decode_base64",
    "encode_uri", "decode_uri", "after", "after_last", "before", "before_last", "between", "between_first",
    "camel", "char_at", "chop_start", "chop_end", "contains_all", "doesnt_contain", "doesnt_start_with", "doesnt_end_with",
    "deduplicate", "excerpt", "finish", "start", "headline", "is", "is_ascii", "is_json", "is_ulid", "is_url", "is_uuid", "is_empty", "is_match",
    "kebab", "snake", "studly", "title", "lcfirst", "ucfirst", "ucwords", "ucsplit", "limit", "mask", "match", "match_all",
    "pad_both", "plural", "singular", "position", "random", "remove", "repeat", "replace_array", "replace_first", "replace_last",
    "replace_matches", "replace_start", "replace_end", "squish", "substr", "substr_count", "substr_replace", "swap", "take",
    "word_count", "word_wrap", "words", "wrap", "unwrap", "uuid", "ulid", "strip_tags", "ascii", "apa", "class_basename",
  ] as const,
  [ConnectorId.Utility.Random]: [
    "random_int", "random_float", "random_string", "random_uuid", "uuid", "random_boolean", "random_choice",
    "random_password", "random_hex", "random_alphanumeric", "random_date", "random_color", "shuffle_array",
  ] as const,
  [ConnectorId.Utility.Math]: [
    "add", "subtract", "multiply", "divide", "modulo", "power", "round", "floor", "ceil",
    "abs", "min", "max", "average", "sum", "clamp", "random_between", "percentage", "percentage_of", "sqrt", "log",
  ] as const,
  [ConnectorId.Utility.Compare]: [
    "diff_objects",
    "diff_arrays",
    "compare_strings",
    "compare_numbers",
    "compare_dates",
    "is_changed",
    "is_equal",
    "is_not_equal",
    "is_greater_than",
    "is_less_than",
    "is_between",
    "is_empty",
    "is_null_or_undefined",
    "is_same_type",
    "deep_equal",
    "shallow_equal",
    "similarity_score",
    "array_intersection",
    "array_union",
    "array_difference",
  ] as const,
  [ConnectorId.Utility.Geo]: [
    "calculate_distance",
    "point_in_polygon",
    "get_bounding_box",
    "reverse_geocode",
    "geocode",
    "convert_coordinates",
  ] as const,
  [ConnectorId.Encryption.Base64]: ["base64.encode", "base64.decode"] as const,
  [ConnectorId.Encryption.Hash]: ["hash", "hash.md5", "hash.sha1", "hash.sha256", "hash.sha512"] as const,
  [ConnectorId.Encryption.AES]: ["aes.encrypt", "aes.decrypt", "aes.generate_key", "aes.generate_iv"] as const,
  [ConnectorId.Encryption.RSA]: ["rsa.generate_keypair", "rsa.encrypt", "rsa.decrypt", "rsa.sign", "rsa.verify"] as const,
  [ConnectorId.Encryption.HMAC]: ["hmac.create", "hmac.verify"] as const,
  [ConnectorId.Encryption.Password]: [
    "password.argon2_hash",
    "password.argon2_verify",
    "password.pbkdf2_hash",
    "password.pbkdf2_verify",
    "password.scrypt_hash",
    "password.scrypt_verify",
    "password.bcrypt_hash",
    "password.bcrypt_verify",
    "password.generate_salt",
  ] as const,
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

export function getConnectorActions(connectorId: string): readonly string[] {
  const actions = ConnectorActions[connectorId as keyof typeof ConnectorActions];
  return actions ?? [];
}

export function listBuiltInConnectors(): Array<{
  id: string;
  category: string;
  actions: readonly string[];
}> {
  const result: Array<{ id: string; category: string; actions: readonly string[] }> = [];
  for (const [id, actions] of Object.entries(ConnectorActions)) {
    result.push({
      id,
      category: id.includes(".") ? id.split(".")[0] : "custom",
      actions: actions as readonly string[],
    });
  }
  return result;
}
