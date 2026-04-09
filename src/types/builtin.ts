import type { ConnectorId, ConnectorActions } from "../connectors/registry";

export type AuthConnectorId = "bearer.system" | "api_key.system" | "basic.system" | "custom_header.system";

export type AuthAction =
  | "bearer.create"
  | "bearer.validate"
  | "api_key.create"
  | "api_key.validate"
  | "basic.create"
  | "basic.validate"
  | "custom_header.create"
  | "custom_header.validate"
  | "create"
  | "validate";

export type BearerCreateConfig =
  | {
      token: string;
      prefix?: string;
      header_name?: string;
      expires_in?: number;
    }
  | ({
      payload?: Record<string, unknown>;
      expires_in?: string | number;
      prefix?: string;
      header_name?: string;
    } & ({ token_secret: string } | { tokenSecret: string }));

export type BearerValidateConfig = {
  token?: string;
  token_secret?: string;
  tokenSecret?: string;
  required_prefix?: string;
  allow_from_headers?: boolean;
};

export type ApiKeyCreateConfig = {
  api_key: string;
  name?: string;
  in?: "header" | "query";
  prefix?: string;
};

export type ApiKeyValidateConfig = {
  api_key?: string;
  name?: string;
  in?: "header" | "query";
  allow_from_headers?: boolean;
  allow_from_query?: boolean;
};

export type AuthConfigByConnector = {
  "bearer.system": {
    "bearer.create": BearerCreateConfig;
    create: BearerCreateConfig;
    "bearer.validate": BearerValidateConfig;
    validate: BearerValidateConfig;
  };
  "api_key.system": {
    "api_key.create": ApiKeyCreateConfig;
    create: ApiKeyCreateConfig;
    "api_key.validate": ApiKeyValidateConfig;
    validate: ApiKeyValidateConfig;
  };
  "basic.system": {
    "basic.create": { username: string; password: string };
    create: { username: string; password: string };
    "basic.validate": { username?: string; password?: string; expected_username?: string; expected_password?: string };
    validate: { username?: string; password?: string; expected_username?: string; expected_password?: string };
  };
  "custom_header.system": {
    "custom_header.create": { headers: Record<string, string | number | boolean> };
    create: { headers: Record<string, string | number | boolean> };
    "custom_header.validate": { headers?: Record<string, string | number | boolean>; required_headers?: string[] };
    validate: { headers?: Record<string, string | number | boolean>; required_headers?: string[] };
  };
};

export type AuthActionForConnector<TConnectorId extends AuthConnectorId> = keyof AuthConfigByConnector[TConnectorId] & string;

export type AuthConfigFor<
  TConnectorId extends AuthConnectorId,
  TAction extends AuthActionForConnector<TConnectorId>,
> = AuthConfigByConnector[TConnectorId][TAction];

export type UtilityConnectorId =
  | "utility.date_time"
  | "utility.string"
  | "utility.random"
  | "utility.math"
  | "utility.compare"
  | "utility.geo";

export type UtilityAction =
  | (typeof ConnectorActions)[(typeof ConnectorId)["Utility"]["DateTime"]][keyof (typeof ConnectorActions)[(typeof ConnectorId)["Utility"]["DateTime"]]]
  | (typeof ConnectorActions)[(typeof ConnectorId)["Utility"]["String"]][keyof (typeof ConnectorActions)[(typeof ConnectorId)["Utility"]["String"]]]
  | (typeof ConnectorActions)[(typeof ConnectorId)["Utility"]["Random"]][keyof (typeof ConnectorActions)[(typeof ConnectorId)["Utility"]["Random"]]]
  | (typeof ConnectorActions)[(typeof ConnectorId)["Utility"]["Math"]][keyof (typeof ConnectorActions)[(typeof ConnectorId)["Utility"]["Math"]]]
  | (typeof ConnectorActions)[(typeof ConnectorId)["Utility"]["Compare"]][keyof (typeof ConnectorActions)[(typeof ConnectorId)["Utility"]["Compare"]]]
  | (typeof ConnectorActions)[(typeof ConnectorId)["Utility"]["Geo"]][keyof (typeof ConnectorActions)[(typeof ConnectorId)["Utility"]["Geo"]]];

export type EncryptionConnectorId =
  | "base64.encryption"
  | "hash.encryption"
  | "aes.encryption"
  | "rsa.encryption"
  | "hmac.encryption"
  | "password.encryption";

export type EncryptionAction =
  | "base64.encode"
  | "base64.decode"
  | "hash"
  | "hash.md5"
  | "hash.sha1"
  | "hash.sha256"
  | "hash.sha512"
  | "aes.encrypt"
  | "aes.decrypt"
  | "aes.generate_key"
  | "aes.generate_iv"
  | "rsa.generate_keypair"
  | "rsa.encrypt"
  | "rsa.decrypt"
  | "rsa.sign"
  | "rsa.verify"
  | "hmac.create"
  | "hmac.verify"
  | "password.argon2_hash"
  | "password.argon2_verify"
  | "password.pbkdf2_hash"
  | "password.pbkdf2_verify"
  | "password.scrypt_hash"
  | "password.scrypt_verify"
  | "password.bcrypt_hash"
  | "password.bcrypt_verify"
  | "password.generate_salt";

export type DbEngine = "mongodb" | "mysql";

export type DbAction =
  | "insertOne"
  | "insertMany"
  | "findOne"
  | "find"
  | "updateOne"
  | "deleteOne"
  | "query";

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export type ResponderType = "http" | "json" | "raw" | "redirect" | "empty";
