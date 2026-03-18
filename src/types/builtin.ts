import type { ConnectorId, ConnectorActions } from "../connectors/registry";

export type AuthConnectorId = "bearer.system" | "api_key.system";

export type AuthAction = "bearer.validate" | "api_key.validate";

export type UtilityConnectorId =
  | "utility.date_time"
  | "utility.string"
  | "utility.random"
  | "utility.math"
  | "utility.compare"
  | "utility.geo";

export type UtilityAction =
  | (typeof ConnectorActions)[(typeof ConnectorId)["Utility"]["DateTime"]][number]
  | (typeof ConnectorActions)[(typeof ConnectorId)["Utility"]["String"]][number]
  | (typeof ConnectorActions)[(typeof ConnectorId)["Utility"]["Random"]][number]
  | (typeof ConnectorActions)[(typeof ConnectorId)["Utility"]["Math"]][number]
  | (typeof ConnectorActions)[(typeof ConnectorId)["Utility"]["Compare"]][number]
  | (typeof ConnectorActions)[(typeof ConnectorId)["Utility"]["Geo"]][number];

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
