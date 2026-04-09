export const jsonResponderConnector = {
  _id: "json.responder",
  type: "system",
  name: "JSON Responder",
  meta: { category: "responder" },
  auth: { type: "none" },
};

export const httpResponderConnector = {
  _id: "http.responder",
  type: "system",
  name: "HTTP Responder",
  meta: { category: "responder" },
  auth: { type: "none" },
};

export const rawResponderConnector = {
  _id: "raw.responder",
  type: "system",
  name: "Raw Responder",
  meta: { category: "responder" },
  auth: { type: "none" },
};

export const redirectResponderConnector = {
  _id: "redirect.responder",
  type: "system",
  name: "Redirect Responder",
  meta: { category: "responder" },
  auth: { type: "none" },
};

export const emptyResponderConnector = {
  _id: "empty.responder",
  type: "system",
  name: "Empty Responder",
  meta: { category: "responder" },
  auth: { type: "none" },
};

export const conditionLogicConnector = {
  _id: "condition.logic",
  type: "system",
  name: "Condition",
  meta: { category: "logic" },
  auth: { type: "none" },
};

export const mongodbConnector = {
  _id: "mongodb.system",
  type: "system",
  name: "MongoDB",
  meta: { category: "database" },
  auth: { type: "fields", mode: "fields" },
};

export const mysqlConnector = {
  _id: "mysql.system",
  type: "system",
  name: "MySQL",
  meta: { category: "database" },
  auth: { type: "fields", mode: "fields" },
};

export const postgresConnector = {
  _id: "postgres.system",
  type: "system",
  name: "PostgreSQL",
  meta: { category: "database" },
  auth: { type: "fields", mode: "fields" },
};

export const redisConnector = {
  _id: "redis.system",
  type: "system",
  name: "Redis",
  meta: { category: "database" },
  auth: { type: "fields", mode: "fields" },
};

export const bearerAuthConnector = {
  _id: "bearer.system",
  type: "system",
  name: "Bearer Auth",
  meta: { category: "authentication" },
  auth: { type: "bearer" },
  actions: [
    { id: "bearer.create", name: "Create" },
    { id: "bearer.validate", name: "Validate" },
  ],
};

export const apiKeyAuthConnector = {
  _id: "api_key.system",
  type: "system",
  name: "API Key",
  meta: { category: "authentication" },
  auth: { type: "api_key" },
  actions: [
    { id: "api_key.create", name: "Create" },
    { id: "api_key.validate", name: "Validate" },
  ],
};

export const basicAuthConnector = {
  _id: "basic.system",
  type: "system",
  name: "Basic Auth",
  meta: { category: "authentication" },
  auth: { type: "basic" },
  actions: [
    { id: "basic.create", name: "Create" },
    { id: "basic.validate", name: "Validate" },
  ],
};

export const customHeaderAuthConnector = {
  _id: "custom_header.system",
  type: "system",
  name: "Custom Header Auth",
  meta: { category: "authentication" },
  auth: { type: "custom_header" },
  actions: [
    { id: "custom_header.create", name: "Create" },
    { id: "custom_header.validate", name: "Validate" },
  ],
};

export const dateTimeUtilityConnector = {
  _id: "utility.date_time",
  type: "system",
  name: "Date/Time",
  meta: { category: "utility" },
  actions: [
    { id: "get_current_date", name: "Get Current Date" },
    { id: "get_current_time", name: "Get Current Time" },
    { id: "get_current_datetime", name: "Get Current DateTime" },
    { id: "format", name: "Format" },
    { id: "format_date", name: "Format Date" },
    { id: "parse_date", name: "Parse Date" },
    { id: "add_time", name: "Add Time" },
    { id: "subtract_time", name: "Subtract Time" },
    { id: "diff_between_dates", name: "Diff Between Dates" },
    { id: "start_of_day", name: "Start of Day" },
    { id: "end_of_day", name: "End of Day" },
    { id: "start_of_week", name: "Start of Week" },
    { id: "end_of_week", name: "End of Week" },
    { id: "start_of_month", name: "Start of Month" },
    { id: "end_of_month", name: "End of Month" },
    { id: "start_of_year", name: "Start of Year" },
    { id: "end_of_year", name: "End of Year" },
    { id: "convert_timezone", name: "Convert Timezone" },
    { id: "get_timezone", name: "Get Timezone" },
    { id: "list_timezones", name: "List Timezones" },
    { id: "is_leap_year", name: "Is Leap Year" },
    { id: "get_unix_timestamp", name: "Get Unix Timestamp" },
    { id: "from_unix_timestamp", name: "From Unix Timestamp" },
  ],
};

export const stringUtilityConnector = {
  _id: "utility.string",
  type: "system",
  name: "String",
  meta: { category: "utility" },
  actions: [
    { id: "concat", name: "Concatenate" }, { id: "split", name: "Split" }, { id: "join", name: "Join" },
    { id: "replace", name: "Replace" }, { id: "replace_all", name: "Replace All" }, { id: "trim", name: "Trim" },
    { id: "trim_start", name: "Trim Start" }, { id: "trim_end", name: "Trim End" },
    { id: "to_uppercase", name: "To Uppercase" }, { id: "to_lowercase", name: "To Lowercase" },
    { id: "capitalize", name: "Capitalize" }, { id: "substring", name: "Substring" }, { id: "length", name: "Length" },
    { id: "contains", name: "Contains" }, { id: "starts_with", name: "Starts With" }, { id: "ends_with", name: "Ends With" },
    { id: "remove_whitespace", name: "Remove Whitespace" }, { id: "slugify", name: "Slugify" },
    { id: "pad_start", name: "Pad Start" }, { id: "pad_end", name: "Pad End" }, { id: "reverse", name: "Reverse" },
    { id: "encode_base64", name: "Encode Base64" }, { id: "decode_base64", name: "Decode Base64" },
    { id: "encode_uri", name: "Encode URI" }, { id: "decode_uri", name: "Decode URI" },
    { id: "after", name: "After" }, { id: "after_last", name: "After Last" }, { id: "before", name: "Before" },
    { id: "before_last", name: "Before Last" }, { id: "between", name: "Between" }, { id: "between_first", name: "Between First" },
    { id: "camel", name: "Camel Case" }, { id: "char_at", name: "Char At" }, { id: "chop_start", name: "Chop Start" },
    { id: "chop_end", name: "Chop End" }, { id: "contains_all", name: "Contains All" }, { id: "doesnt_contain", name: "Doesn't Contain" },
    { id: "doesnt_start_with", name: "Doesn't Start With" }, { id: "doesnt_end_with", name: "Doesn't End With" },
    { id: "deduplicate", name: "Deduplicate" }, { id: "excerpt", name: "Excerpt" }, { id: "finish", name: "Finish" },
    { id: "start", name: "Start" }, { id: "headline", name: "Headline" }, { id: "is", name: "Is Pattern" },
    { id: "is_ascii", name: "Is ASCII" }, { id: "is_json", name: "Is JSON" }, { id: "is_ulid", name: "Is ULID" },
    { id: "is_url", name: "Is URL" }, { id: "is_uuid", name: "Is UUID" }, { id: "is_empty", name: "Is Empty" },
    { id: "is_match", name: "Is Match" }, { id: "kebab", name: "Kebab Case" }, { id: "snake", name: "Snake Case" },
    { id: "studly", name: "Studly Case" }, { id: "title", name: "Title Case" }, { id: "lcfirst", name: "Lcfirst" },
    { id: "ucfirst", name: "Ucfirst" }, { id: "ucwords", name: "Ucwords" }, { id: "ucsplit", name: "Ucsplit" },
    { id: "limit", name: "Limit" }, { id: "mask", name: "Mask" }, { id: "match", name: "Match" }, { id: "match_all", name: "Match All" },
    { id: "pad_both", name: "Pad Both" }, { id: "plural", name: "Plural" }, { id: "singular", name: "Singular" },
    { id: "position", name: "Position" }, { id: "random", name: "Random" }, { id: "remove", name: "Remove" },
    { id: "repeat", name: "Repeat" }, { id: "replace_array", name: "Replace Array" }, { id: "replace_first", name: "Replace First" },
    { id: "replace_last", name: "Replace Last" }, { id: "replace_matches", name: "Replace Matches" },
    { id: "replace_start", name: "Replace Start" }, { id: "replace_end", name: "Replace End" },
    { id: "squish", name: "Squish" }, { id: "substr", name: "Substr" }, { id: "substr_count", name: "Substr Count" },
    { id: "substr_replace", name: "Substr Replace" }, { id: "swap", name: "Swap" }, { id: "take", name: "Take" },
    { id: "word_count", name: "Word Count" }, { id: "word_wrap", name: "Word Wrap" }, { id: "words", name: "Words" },
    { id: "wrap", name: "Wrap" }, { id: "unwrap", name: "Unwrap" }, { id: "uuid", name: "UUID" }, { id: "ulid", name: "ULID" },
    { id: "strip_tags", name: "Strip Tags" }, { id: "ascii", name: "ASCII" }, { id: "apa", name: "APA" },
    { id: "class_basename", name: "Class Basename" },
  ],
};

export const randomUtilityConnector = {
  _id: "utility.random",
  type: "system",
  name: "Random",
  meta: { category: "utility" },
  actions: [
    { id: "random_int", name: "Random Integer" }, { id: "random_float", name: "Random Float" },
    { id: "random_string", name: "Random String" }, { id: "random_uuid", name: "Random UUID" },
    { id: "uuid", name: "UUID" }, { id: "random_boolean", name: "Random Boolean" },
    { id: "random_choice", name: "Random Choice" }, { id: "random_password", name: "Random Password" },
    { id: "random_hex", name: "Random Hex" }, { id: "random_alphanumeric", name: "Random Alphanumeric" },
    { id: "random_date", name: "Random Date" }, { id: "random_color", name: "Random Color" },
    { id: "shuffle_array", name: "Shuffle Array" },
  ],
};

export const mathUtilityConnector = {
  _id: "utility.math",
  type: "system",
  name: "Math",
  meta: { category: "utility" },
  actions: [
    { id: "add", name: "Add" }, { id: "subtract", name: "Subtract" }, { id: "multiply", name: "Multiply" },
    { id: "divide", name: "Divide" }, { id: "modulo", name: "Modulo" }, { id: "power", name: "Power" },
    { id: "round", name: "Round" }, { id: "floor", name: "Floor" }, { id: "ceil", name: "Ceil" },
    { id: "abs", name: "Abs" }, { id: "min", name: "Min" }, { id: "max", name: "Max" },
    { id: "average", name: "Average" }, { id: "sum", name: "Sum" }, { id: "clamp", name: "Clamp" },
    { id: "random_between", name: "Random Between" }, { id: "percentage", name: "Percentage" },
    { id: "percentage_of", name: "Percentage Of" }, { id: "sqrt", name: "Sqrt" }, { id: "log", name: "Log" },
  ],
};

export const compareUtilityConnector = {
  _id: "utility.compare",
  type: "system",
  name: "Comparison / Diff",
  meta: { category: "utility" },
  actions: [
    { id: "diff_objects", name: "Diff Objects" },
    { id: "diff_arrays", name: "Diff Arrays" },
    { id: "compare_strings", name: "Compare Strings" },
    { id: "compare_numbers", name: "Compare Numbers" },
    { id: "compare_dates", name: "Compare Dates" },
    { id: "is_changed", name: "Is Changed" },
    { id: "is_equal", name: "Is Equal" },
    { id: "is_not_equal", name: "Is Not Equal" },
    { id: "is_greater_than", name: "Is Greater Than" },
    { id: "is_less_than", name: "Is Less Than" },
    { id: "is_between", name: "Is Between" },
    { id: "is_empty", name: "Is Empty" },
    { id: "is_null_or_undefined", name: "Is Null Or Undefined" },
    { id: "is_same_type", name: "Is Same Type" },
    { id: "deep_equal", name: "Deep Equal" },
    { id: "shallow_equal", name: "Shallow Equal" },
    { id: "similarity_score", name: "Similarity Score" },
    { id: "array_intersection", name: "Array Intersection" },
    { id: "array_union", name: "Array Union" },
    { id: "array_difference", name: "Array Difference" },
  ],
};

export const geoUtilityConnector = {
  _id: "utility.geo",
  type: "system",
  name: "Geo / Location",
  meta: { category: "utility" },
  actions: [
    { id: "calculate_distance", name: "Calculate Distance" },
    { id: "point_in_polygon", name: "Point in Polygon" },
    { id: "get_bounding_box", name: "Get Bounding Box" },
    { id: "reverse_geocode", name: "Reverse Geocode" },
    { id: "geocode", name: "Geocode" },
    { id: "convert_coordinates", name: "Convert Coordinates" },
  ],
};

export const base64EncryptionConnector = {
  _id: "base64.encryption",
  type: "system",
  name: "Base64",
  meta: { category: "encryption" },
  actions: [
    { id: "base64.encode", name: "Encode" },
    { id: "base64.decode", name: "Decode" },
  ],
};

export const hashEncryptionConnector = {
  _id: "hash.encryption",
  type: "system",
  name: "Hash",
  meta: { category: "encryption" },
  actions: [
    { id: "hash", name: "Hash" },
    { id: "hash.md5", name: "MD5" },
    { id: "hash.sha1", name: "SHA-1" },
    { id: "hash.sha256", name: "SHA-256" },
    { id: "hash.sha512", name: "SHA-512" },
  ],
};

export const aesEncryptionConnector = {
  _id: "aes.encryption",
  type: "system",
  name: "AES",
  meta: { category: "encryption" },
  actions: [
    { id: "aes.encrypt", name: "Encrypt" },
    { id: "aes.decrypt", name: "Decrypt" },
    { id: "aes.generate_key", name: "Generate Key" },
    { id: "aes.generate_iv", name: "Generate IV" },
  ],
};

export const rsaEncryptionConnector = {
  _id: "rsa.encryption",
  type: "system",
  name: "RSA",
  meta: { category: "encryption" },
  actions: [
    { id: "rsa.generate_keypair", name: "Generate Key Pair" },
    { id: "rsa.encrypt", name: "Encrypt" },
    { id: "rsa.decrypt", name: "Decrypt" },
    { id: "rsa.sign", name: "Sign" },
    { id: "rsa.verify", name: "Verify" },
  ],
};

export const hmacEncryptionConnector = {
  _id: "hmac.encryption",
  type: "system",
  name: "HMAC",
  meta: { category: "encryption" },
  actions: [
    { id: "hmac.create", name: "Create HMAC" },
    { id: "hmac.verify", name: "Verify HMAC" },
  ],
};

export const passwordEncryptionConnector = {
  _id: "password.encryption",
  type: "system",
  name: "Password Hashing",
  meta: { category: "encryption" },
  actions: [
    { id: "password.argon2_hash", name: "Argon2 Hash" },
    { id: "password.argon2_verify", name: "Argon2 Verify" },
    { id: "password.pbkdf2_hash", name: "PBKDF2 Hash" },
    { id: "password.pbkdf2_verify", name: "PBKDF2 Verify" },
    { id: "password.scrypt_hash", name: "scrypt Hash" },
    { id: "password.scrypt_verify", name: "scrypt Verify" },
    { id: "password.bcrypt_hash", name: "bcrypt Hash" },
    { id: "password.bcrypt_verify", name: "bcrypt Verify" },
    { id: "password.generate_salt", name: "Generate Salt" },
  ],
};

export function createCliodotConnector(config: { baseUrl: string; apiKey: string }) {
  return {
    _id: "cliodot",
    type: "REST",
    name: "Cliodot",
    base_url: config.baseUrl.replace(/\/+$/, ""),
    auth: { type: "bearer", token: config.apiKey },
    endpoints: [
      { name: "Login", action: "Login", method: "POST", path: "/user/login" },
      { name: "Register Individual", action: "Register Individual", method: "POST", path: "/user/register" },
      { name: "Accounts", action: "Accounts", method: "GET", path: "/user/accounts" },
      { name: "Get Profile", action: "Get Profile", method: "GET", path: "/user/profile" },
      { name: "Update Profile", action: "Update Profile", method: "PUT", path: "/user/profile" },
    ],
  };
}
