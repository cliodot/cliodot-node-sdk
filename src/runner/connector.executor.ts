import axios from "axios";
import jwt from "jsonwebtoken";
import { renderTemplate } from "../template";
import { isTypedConnectorDef } from "../connectors/registry";
import { jsonResponderConnector } from "../connectors/builtin";
import { executeString } from "./utilities/string.executor";
import { executeMath } from "./utilities/math.executor";
import { executeRandom } from "./utilities/random.executor";

type ConnectorDef = any;
type ExecOptions = Record<string, any>;

async function renderBodyRecursive(
  val: any,
  context: Record<string, any>
): Promise<any> {
  if (val == null) return val;
  if (typeof val === "string" && val.includes("{{")) {
    const rendered = await renderTemplate(val, context);
    if (typeof rendered === "string" && rendered.startsWith("{") && rendered.endsWith("}")) {
      try {
        return JSON.parse(rendered);
      } catch {
        return rendered;
      }
    }
    return rendered;
  }
  if (Array.isArray(val)) {
    return Promise.all(val.map((v) => renderBodyRecursive(v, context)));
  }
  if (typeof val === "object") {
    const out: Record<string, any> = {};
    for (const k of Object.keys(val)) {
      out[k] = await renderBodyRecursive(val[k], context);
    }
    return out;
  }
  return val;
}

function rethrowConnectorHttpError(err: unknown): never {
  if (axios.isAxiosError(err)) {
    const res = err.response;
    const data = res?.data;
    const message =
      (data &&
        typeof data === "object" &&
        ((typeof (data as any).message === "string" && (data as any).message) ||
          (typeof (data as any).error === "string" && (data as any).error))) ||
      err.message ||
      "Request failed";
    const wrapped: any = new Error(message);
    wrapped.status = res?.status;
    wrapped.response = data;
    wrapped.data = data;
    if (data && typeof data === "object" && typeof (data as any).code === "string") {
      wrapped.code = (data as any).code;
    }
    throw wrapped;
  }
  throw err;
}

async function executeResponder(connectorDef: ConnectorDef, options: ExecOptions, context: any): Promise<any> {
  const id = connectorDef._id || connectorDef.id || "";
  if (id === "raw.responder") {
    const statusCode = options.statusCode ?? 200;
    const contentType = options.contentType || "text/plain";
    let body = options.body ?? "";
    if (body !== undefined && body !== null && typeof body === "string") {
      body = await renderTemplate(body, context);
    }
    return { statusCode, headers: { "content-type": contentType }, body, terminate: true };
  }
  if (id === "redirect.responder") {
    const statusCode = options.statusCode ?? 302;
    let location = options.location ?? "";
    if (typeof location === "string") location = await renderTemplate(location, context);
    return { statusCode, headers: { location }, terminate: true };
  }
  if (id === "empty.responder") {
    const statusCode = options.statusCode ?? 202;
    return { statusCode, terminate: true };
  }
  const statusCode = options.statusCode ?? 200;
  let body = options.body;
  if (body !== undefined && body !== null) {
    body = await renderBodyRecursive(body, context);
  }
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (options.headers && typeof options.headers === "object") {
    for (const [k, v] of Object.entries(options.headers)) {
      if (typeof v === "string" && v.includes("{{")) {
        headers[k] = await renderTemplate(v, context);
      } else {
        headers[k] = String(v);
      }
    }
  }
  return { statusCode, headers, body, terminate: true };
}

async function executeRestConnector(
  connectorDef: ConnectorDef,
  actionName: string,
  options: ExecOptions,
  context: any
): Promise<any> {
  const endpoints = connectorDef.endpoints || [];
  const endpoint = endpoints.find(
    (e: any) => e.name === actionName || e.action === actionName
  );
  if (!endpoint) throw new Error("Endpoint not found: " + actionName);

  let path = endpoint.path || "";
  const pathParams = { ...(endpoint.pathParams || {}), ...(options.pathParams || {}) };
  for (const k of Object.keys(pathParams)) {
    const val = pathParams[k];
    path = path.replace(
      new RegExp(`\\{\\{\\s*${k}\\s*\\}\\}|[:{]${k}[}]?`, "g"),
      encodeURIComponent(String(val))
    );
  }
  if (path.includes("{{")) path = await renderTemplate(path, context);

  const base = (connectorDef.base_url || "").replace(/\/+$/, "");
  const url = base + (path.startsWith("/") ? path : "/" + path);

  const params = { ...(endpoint.params || {}), ...(options.params || {}) };
  for (const k of Object.keys(params)) {
    if (typeof params[k] === "string" && params[k].includes("{{")) {
      params[k] = await renderTemplate(params[k], context);
    }
  }

  let body = options.body ?? endpoint.body ?? null;
  if (body && typeof body === "object") {
    body = JSON.parse(await renderTemplate(JSON.stringify(body), context));
  } else if (typeof body === "string" && body.includes("{{")) {
    body = await renderTemplate(body, context);
  }

  const headers: Record<string, string> = { ...(endpoint.headers || {}) };
  const auth = connectorDef.auth || {};
  if (auth.type === "bearer" && auth.token) {
    const headerKey = auth.header_name || "Authorization";
    const prefix = auth.prefix ?? "Bearer ";
    headers[headerKey] = prefix + auth.token;
  }
  if (auth.type === "api_key" && auth.api_key) {
    const key = auth.key_name || "Authorization";
    headers[key] = auth.api_key;
  }
  const optionHeaders = options.headers || {};
  for (const [k, v] of Object.entries(optionHeaders)) {
    if (typeof v === "string" && v.includes("{{")) {
      headers[k] = await renderTemplate(v, context);
    } else {
      headers[k] = String(v);
    }
  }

  const method = (endpoint.method || "GET").toUpperCase();
  const cfg: any = {
    method: method.toLowerCase(),
    url,
    params,
    headers,
    timeout: options.timeout || endpoint.timeout_ms || 10000,
  };
  if (body !== null && body !== undefined && method !== "GET") {
    cfg.data = body;
  }

  const connectorConfig = context?.connectorConfig?.[connectorDef._id] || {};
  if (connectorConfig.apiKey && auth.type === "bearer") {
    const headerKey = auth.header_name || "Authorization";
    const prefix = auth.prefix ?? "Bearer ";
    headers[headerKey] = prefix + connectorConfig.apiKey;
  }

  let resp;
  try {
    resp = await axios(cfg);
  } catch (e) {
    rethrowConnectorHttpError(e);
  }

  const raw = resp.data;
  let mapped: any;
  if (endpoint.response_mapping && typeof endpoint.response_mapping === "object") {
    mapped = {};
    for (const [outKey, srcPath] of Object.entries(endpoint.response_mapping)) {
      mapped[outKey] = getByPath(raw, srcPath as string);
    }
  } else {
    mapped = raw;
  }
  const responseWarnings = collectRestResponseWarnings(endpoint, mapped, connectorDef, actionName);
  const out: any = { raw, mapped };
  if (responseWarnings.length) out.responseWarnings = responseWarnings;
  return out;
}

function getByPath(obj: any, path: string): any {
  if (!obj || !path) return undefined;
  const parts = path.split(".");
  let cur = obj;
  for (const p of parts) {
    if (cur == null) return undefined;
    cur = cur[p];
  }
  return cur;
}

function collectRestResponseWarnings(
  endpoint: any,
  mapped: any,
  connectorDef: ConnectorDef,
  actionName: string
): string[] {
  const w: string[] = [];
  const cid = connectorDef._id || connectorDef.id || "connector";
  if (endpoint.response_mapping && mapped != null && typeof mapped === "object" && !Array.isArray(mapped)) {
    for (const [outKey, srcPath] of Object.entries(endpoint.response_mapping)) {
      if (!Object.prototype.hasOwnProperty.call(mapped, outKey)) {
        w.push(`response_mapping output "${outKey}" missing from mapped result (path "${String(srcPath)}")`);
      } else if (mapped[outKey] === undefined) {
        w.push(
          `response_mapping output "${outKey}" is undefined; provider JSON may not match path "${String(srcPath)}"`
        );
      }
    }
  }
  if (isTypedConnectorDef(connectorDef)) {
    const schema = (connectorDef as { __schemas?: Record<string, { response?: unknown }> }).__schemas?.[actionName];
    const sample = schema?.response;
    if (sample != null && typeof sample === "object" && !Array.isArray(sample)) {
      const keys = Object.keys(sample as object);
      if (keys.length > 0) {
        if (mapped == null || typeof mapped !== "object" || Array.isArray(mapped)) {
          w.push(
            `typed connector "${cid}" action "${actionName}" expected object response, got ${
              mapped === null ? "null" : Array.isArray(mapped) ? "array" : typeof mapped
            }`
          );
        } else {
          for (const k of keys) {
            if (!Object.prototype.hasOwnProperty.call(mapped, k)) {
              w.push(`typed connector "${cid}" expects response key "${k}" but mapped result has no such key`);
              continue;
            }
            const expected = (sample as Record<string, unknown>)[k];
            const actual = (mapped as Record<string, unknown>)[k];
            const expT = expected === null ? "null" : Array.isArray(expected) ? "array" : typeof expected;
            const actT = actual === null ? "null" : Array.isArray(actual) ? "array" : typeof actual;
            if (expT !== actT) {
              w.push(
                `typed connector "${cid}" response key "${k}" declared as ${expT} but provider returned ${actT}`
              );
            }
          }
        }
      }
    }
  }
  return w;
}

async function executeDbConnector(
  connectorDef: ConnectorDef,
  actionName: string,
  options: ExecOptions,
  context: any
): Promise<any> {
  const connectorId = connectorDef._id || connectorDef.id;
  const config = context?.connectorConfig?.[connectorId] || context?.env || {};
  const uri = config.uri || config.MONGO_URI || (connectorDef.auth as any)?.uri;
  const database = options.database || config.database || (connectorDef.auth as any)?.database;

  if (!uri) throw new Error("MongoDB URI not configured for " + connectorId);

  if (connectorId === "mongodb.system") {
    try {
      const { MongoClient } = await import("mongodb");
      const client = new MongoClient(uri);
      await client.connect();
      try {
        const db = client.db(database);
        const collection = options.collection;
        if (!collection) throw new Error("collection is required");

        let result: any;
        switch (actionName) {
          case "insertOne":
            result = await db.collection(collection).insertOne(options.document || {});
            return { raw: result, mapped: { insertedId: result.insertedId, ...result } };
          case "insertMany":
            result = await db.collection(collection).insertMany(options.documents || []);
            return { raw: result, mapped: result };
          case "findOne":
            result = await db.collection(collection).findOne(options.filter || {});
            return { raw: result, mapped: result };
          case "find":
            const cursor = db.collection(collection).find(options.filter || {});
            if (options.limit) cursor.limit(options.limit);
            if (options.sort) cursor.sort(options.sort);
            result = await cursor.toArray();
            return { raw: result, mapped: result };
          case "updateOne":
            result = await db.collection(collection).updateOne(options.filter || {}, options.update || {});
            return { raw: result, mapped: result };
          case "deleteOne":
            result = await db.collection(collection).deleteOne(options.filter || {});
            return { raw: result, mapped: result };
          default:
            throw new Error("Unsupported MongoDB action: " + actionName);
        }
      } finally {
        await client.close();
      }
    } catch (e: any) {
      if (e.code === "ERR_MODULE_NOT_FOUND" || e.message?.includes("mongodb")) {
        throw new Error("mongodb package not installed. Add it as a dependency: npm install mongodb");
      }
      throw e;
    }
  }

  if (connectorId === "mysql.system") {
    try {
      const mysql = await import("mysql2/promise");
      const connConfig = config.uri ? { uri: config.uri } : {
        host: config.host || "localhost",
        user: config.user,
        password: config.password,
        database: config.database || database,
      };
      const conn = config.uri
        ? await mysql.createConnection(config.uri)
        : await mysql.createConnection(connConfig);
      try {
        const [rows] = await conn.execute(options.query || "SELECT 1", options.params);
        return { raw: rows, mapped: rows };
      } finally {
        await conn.end();
      }
    } catch (e: any) {
      if (e.code === "ERR_MODULE_NOT_FOUND" || e.message?.includes("mysql2")) {
        throw new Error("mysql2 package not installed. Add it as a dependency: npm install mysql2");
      }
      throw e;
    }
  }

  if (connectorId === "postgres.system") {
    try {
      const { Pool } = await import("pg");
      const poolConfig = config.uri
        ? { connectionString: config.uri }
        : {
            host: config.host || "localhost",
            port: config.port || 5432,
            user: config.username || config.user,
            password: config.password,
            database: config.database || database,
            ssl: config.ssl ? { rejectUnauthorized: false } : undefined,
          };
      const pool = new Pool(poolConfig);
      try {
        const res = await pool.query(options.query || options.sql || "SELECT 1", options.params || []);
        const rows = res.rows;
        const maxRows = options.max_rows ?? 1000;
        return { raw: rows.slice(0, maxRows), mapped: rows.slice(0, maxRows) };
      } finally {
        await pool.end();
      }
    } catch (e: any) {
      if (e.code === "ERR_MODULE_NOT_FOUND" || e.message?.includes("pg")) {
        throw new Error("pg package not installed. Add it as a dependency: npm install pg");
      }
      throw e;
    }
  }

  if (connectorId === "redis.system") {
    try {
      const Redis = (await import("ioredis")).default;
      const url = config.uri || config.url;
      if (!url) throw new Error("Redis URL not configured for redis.system");
      const client = new Redis(url);
      try {
        const actionMethod = actionName.split(".").pop() || actionName;
        let result: any;
        switch (actionMethod) {
          case "get": {
            const val = await client.get(options.key);
            if (val === null) result = null;
            else { try { result = JSON.parse(val); } catch { result = val; } }
            break;
          }
          case "set": {
            const strVal = typeof options.value === "string" ? options.value : JSON.stringify(options.value);
            if (options.ttl && options.ttl > 0) await client.setex(options.key, options.ttl, strVal);
            else await client.set(options.key, strVal);
            result = { ok: true };
            break;
          }
          case "delete":
          case "delete_key": {
            const n = await client.del(options.key);
            result = { deleted: n > 0, count: n };
            break;
          }
          case "hset": {
            const hv = typeof options.value === "string" ? options.value : JSON.stringify(options.value);
            await client.hset(options.key, options.field, hv);
            result = { ok: true };
            break;
          }
          case "hget": {
            const hv = await client.hget(options.key, options.field);
            if (hv === null) result = null;
            else { try { result = JSON.parse(hv); } catch { result = hv; } }
            break;
          }
          case "lpush": {
            const lv = typeof options.value === "string" ? options.value : JSON.stringify(options.value);
            await client.lpush(options.key, lv);
            result = { ok: true };
            break;
          }
          case "lpop": {
            result = await client.lpop(options.key);
            break;
          }
          case "zadd": {
            await client.zadd(options.key, options.score, options.member);
            result = { ok: true };
            break;
          }
          case "create_hash": {
            const vals = options.values || {};
            for (const [f, v] of Object.entries(vals)) {
              await client.hset(options.key, f, typeof v === "string" ? v : JSON.stringify(v));
            }
            result = { ok: true };
            break;
          }
          default:
            throw new Error("Unsupported Redis action: " + actionMethod);
        }
        return { raw: result, mapped: result };
      } finally {
        await client.quit();
      }
    } catch (e: any) {
      if (e.code === "ERR_MODULE_NOT_FOUND" || e.message?.includes("ioredis")) {
        throw new Error("ioredis package not installed. Add it as a dependency: npm install ioredis");
      }
      throw e;
    }
  }

  throw new Error("Unsupported database connector: " + connectorId);
}

function bearerExpiresAtFromExpiresIn(expiresIn: string | number): number | null {
  if (typeof expiresIn === "string") {
    const match = expiresIn.match(/^(\d+)([smhd])$/);
    if (match) {
      const value = parseInt(match[1], 10);
      const unit = match[2];
      const multipliers: Record<string, number> = {
        s: 1000,
        m: 60 * 1000,
        h: 60 * 60 * 1000,
        d: 24 * 60 * 60 * 1000,
      };
      return Date.now() + value * (multipliers[unit] || 1000);
    }
    return null;
  }
  if (typeof expiresIn === "number") {
    return Date.now() + expiresIn * 1000;
  }
  return null;
}

async function executeAuthConnector(
  connectorDef: ConnectorDef,
  actionName: string,
  options: ExecOptions,
  context: any
): Promise<any> {
  const authType = connectorDef._id?.split(".")[0] || "bearer";
  const opts = options.body || options;
  const tokenFromHeader = context.headers?.authorization?.replace(/^Bearer\s+/i, "");
  const token = opts.token ?? tokenFromHeader ?? context.token;
  const actionMethodRaw = actionName.split(".").pop() || "validate";
  const actionMethod = actionMethodRaw.toLowerCase();
  if (authType === "bearer") {
    if (actionMethod === "create") {
      const headerName = opts.header_name || "Authorization";
      const prefix = opts.prefix ?? "Bearer ";
      const secret = opts.token_secret ?? opts.tokenSecret;
      if (secret) {
        const payload = opts.payload ?? context?.payload ?? {};
        const expiresIn = opts.expires_in ?? opts.expiresIn ?? context?.expiresIn ?? "1h";
        const defaultPayload = {
          sub: (payload as { sub?: string; id?: string })?.sub ?? (payload as { id?: string })?.id ?? "workflow",
          iat: Math.floor(Date.now() / 1000),
          ...payload,
        };
        try {
          const signOpts =
            typeof expiresIn === "number"
              ? ({ expiresIn } as jwt.SignOptions)
              : ({ expiresIn: String(expiresIn) } as jwt.SignOptions);
          const signed = jwt.sign(defaultPayload, secret, signOpts);
          const expiresAtMs = bearerExpiresAtFromExpiresIn(
            typeof expiresIn === "number" ? expiresIn : String(expiresIn)
          );
          const expiresAtIso = expiresAtMs != null ? new Date(expiresAtMs).toISOString() : null;
          return {
            ok: true,
            valid: true,
            token: signed,
            token_type: "Bearer",
            expires_in: expiresIn,
            expires_at: expiresAtIso,
            payload: defaultPayload,
            formatted_token: `${prefix}${signed}`,
            auth: {
              type: "bearer",
              header_name: headerName,
              prefix,
              value: `${prefix}${signed}`,
            },
          };
        } catch (e: any) {
          return {
            ok: false,
            valid: false,
            error: e?.message || "Failed to create bearer token",
            message: "Failed to create bearer token",
          };
        }
      }
      const createdToken = opts.token ?? token;
      if (!createdToken) {
        return { valid: false, ok: false, error: "Bearer token not provided", message: "Token is required" };
      }
      const expiresInOpaque = opts.expires_in ?? null;
      return {
        ok: true,
        valid: true,
        token: createdToken,
        auth: {
          type: "bearer",
          header_name: headerName,
          prefix,
          value: `${prefix}${createdToken}`,
          ...(expiresInOpaque != null ? { expires_in: expiresInOpaque } : {}),
        },
      };
    }
    if (actionMethod === "validate") {
      if (!token) {
        return { valid: false, ok: false, error: "Bearer token not provided", message: "Token is required" };
      }
      const validateSecret = opts.token_secret ?? opts.tokenSecret;
      if (validateSecret) {
        try {
          const decoded = jwt.verify(token, validateSecret);
          return {
            valid: true,
            ok: true,
            token,
            decoded,
            payload: decoded,
            message: "Token is valid",
          };
        } catch (error: any) {
          let decodedPayload: jwt.JwtPayload | string | null = null;
          try {
            decodedPayload = jwt.decode(token, { complete: false });
          } catch {}
          return {
            valid: false,
            ok: false,
            token: null,
            decoded: decodedPayload,
            payload: decodedPayload,
            error: error?.message || "Token validation failed",
            message: "Token is invalid or expired",
          };
        }
      }
      const requiredPrefix = opts.required_prefix;
      const rawAuthHeader = context.headers?.authorization || "";
      if (requiredPrefix && rawAuthHeader && !rawAuthHeader.startsWith(requiredPrefix)) {
        return { valid: false, ok: false, token, error: "Bearer token prefix mismatch" };
      }
      return { valid: true, ok: true, token, message: "Token accepted" };
    }
  }
  if (authType === "api_key") {
    const keyName = opts.name || "x-api-key";
    const keyFromHeader = context.headers?.[keyName] ?? context.headers?.["x-api-key"];
    const keyFromQuery = context.query?.[keyName] ?? context.params?.[keyName];
    const key = opts.api_key ?? opts.token ?? keyFromHeader ?? keyFromQuery ?? token;
    if (actionMethod === "create") {
      if (!key) {
        return { valid: false, ok: false, error: "API key not provided" };
      }
      const inLocation = opts.in || "header";
      const prefix = opts.prefix || "";
      return {
        valid: true,
        ok: true,
        token: key,
        auth: {
          type: "api_key",
          in: inLocation,
          name: keyName,
          value: `${prefix}${key}`,
        },
      };
    }
    if (!key) {
      return { valid: false, ok: false, error: "API key not provided" };
    }
    return { valid: true, ok: true, token: key, name: keyName };
  }
  if (authType === "basic") {
    const username = opts.username ?? opts.user;
    const password = opts.password;
    if (actionMethod === "create") {
      if (!username || !password) {
        return { valid: false, ok: false, error: "Username and password are required" };
      }
      const value = `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`;
      return {
        valid: true,
        ok: true,
        auth: { type: "basic", username, value },
      };
    }
    const expectedUsername = opts.expected_username ?? opts.username;
    const expectedPassword = opts.expected_password ?? opts.password;
    const basicHeader = context.headers?.authorization || "";
    let providedUsername = opts.username;
    let providedPassword = opts.password;
    if ((!providedUsername || !providedPassword) && basicHeader.startsWith("Basic ")) {
      try {
        const decoded = Buffer.from(basicHeader.replace(/^Basic\s+/i, ""), "base64").toString("utf8");
        const parts = decoded.split(":");
        providedUsername = providedUsername ?? parts[0];
        providedPassword = providedPassword ?? parts.slice(1).join(":");
      } catch {}
    }
    if (expectedUsername && expectedPassword) {
      const isValid = providedUsername === expectedUsername && providedPassword === expectedPassword;
      return { valid: isValid, ok: isValid, username: providedUsername };
    }
    const present = Boolean(providedUsername && providedPassword);
    return { valid: present, ok: present, username: providedUsername };
  }
  if (authType === "custom_header") {
    const headers = (opts.headers || {}) as Record<string, any>;
    if (actionMethod === "create") {
      return {
        valid: true,
        ok: true,
        auth: {
          type: "custom_header",
          headers,
        },
      };
    }
    const requiredHeaders = Array.isArray(opts.required_headers) ? opts.required_headers : Object.keys(headers);
    const sourceHeaders = context.headers || {};
    const missing = requiredHeaders.filter((h: string) => sourceHeaders[h] == null);
    if (missing.length > 0) {
      return { valid: false, ok: false, error: `Missing required headers: ${missing.join(", ")}` };
    }
    return { valid: true, ok: true };
  }
  return { valid: true, ok: true };
}

function areDeepEqual(obj1: any, obj2: any, ignoreKeys?: string[]): boolean {
  if (obj1 === obj2) return true;
  if (obj1 == null || obj2 == null) return false;
  if (typeof obj1 !== typeof obj2) return false;
  if (Array.isArray(obj1) && Array.isArray(obj2)) {
    if (obj1.length !== obj2.length) return false;
    for (let i = 0; i < obj1.length; i++) {
      if (!areDeepEqual(obj1[i], obj2[i], ignoreKeys)) return false;
    }
    return true;
  }
  if (typeof obj1 === "object") {
    const keys1 = Object.keys(obj1).filter((k) => !ignoreKeys?.includes(k));
    const keys2 = Object.keys(obj2).filter((k) => !ignoreKeys?.includes(k));
    if (keys1.length !== keys2.length) return false;
    for (const key of keys1) {
      if (!keys2.includes(key)) return false;
      if (!areDeepEqual(obj1[key], obj2[key], ignoreKeys)) return false;
    }
    return true;
  }
  return false;
}

function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = [];
  for (let i = 0; i <= str2.length; i++) matrix[i] = [i];
  for (let j = 0; j <= str1.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[str2.length][str1.length];
}

function levenshteinSimilarity(str1: string, str2: string): number {
  const maxLen = Math.max(str1.length, str2.length);
  if (maxLen === 0) return 1;
  return 1 - levenshteinDistance(str1, str2) / maxLen;
}

function executeCompare(opts: any, actionMethod: string): any {
  switch (actionMethod) {
    case "diff_objects": {
      const { object1, object2, deep = true, ignore_keys = [], include_added = true, include_removed = true, include_changed = true } = opts;
      if (!object1 || !object2) throw new Error("Both objects are required");
      const diff: any = {};
      const allKeys = new Set([...Object.keys(object1), ...Object.keys(object2)]);
      for (const key of allKeys) {
        if (ignore_keys.includes(key)) continue;
        const val1 = object1[key];
        const val2 = object2[key];
        const has1 = key in object1;
        const has2 = key in object2;
        if (!has1 && has2 && include_added) diff[key] = { type: "added", value: val2 };
        else if (has1 && !has2 && include_removed) diff[key] = { type: "removed", value: val1 };
        else if (has1 && has2 && include_changed) {
          const changed = deep ? !areDeepEqual(val1, val2, ignore_keys) : val1 !== val2;
          if (changed) diff[key] = { type: "changed", old: val1, new: val2 };
        }
      }
      return { diff, has_changes: Object.keys(diff).length > 0 };
    }
    case "diff_arrays": {
      const { array1, array2, compare_order = false, deep = true, include_added = true, include_removed = true, include_changed = true } = opts;
      if (!Array.isArray(array1) || !Array.isArray(array2)) throw new Error("Both arrays are required");
      const diff: any = { added: [], removed: [], changed: [] };
      if (compare_order) {
        const maxLen = Math.max(array1.length, array2.length);
        for (let i = 0; i < maxLen; i++) {
          if (i >= array1.length && include_added) diff.added.push({ index: i, value: array2[i] });
          else if (i >= array2.length && include_removed) diff.removed.push({ index: i, value: array1[i] });
          else if (include_changed) {
            const changed = deep ? !areDeepEqual(array1[i], array2[i]) : array1[i] !== array2[i];
            if (changed) diff.changed.push({ index: i, old: array1[i], new: array2[i] });
          }
        }
      } else {
        for (const item of array2) {
          if (!array1.some((a) => (deep ? areDeepEqual(a, item) : a === item)) && include_added) diff.added.push({ value: item });
        }
        for (const item of array1) {
          if (!array2.some((a) => (deep ? areDeepEqual(a, item) : a === item)) && include_removed) diff.removed.push({ value: item });
        }
      }
      return { diff, has_changes: diff.added.length > 0 || diff.removed.length > 0 || diff.changed.length > 0 };
    }
    case "compare_strings": {
      const { string1, string2, case_sensitive = true, trim = false, method = "exact" } = opts;
      if (string1 === undefined || string2 === undefined) throw new Error("Both strings are required");
      let s1 = String(string1);
      let s2 = String(string2);
      if (trim) {
        s1 = s1.trim();
        s2 = s2.trim();
      }
      if (!case_sensitive) {
        s1 = s1.toLowerCase();
        s2 = s2.toLowerCase();
      }
      if (method === "exact") return { equal: s1 === s2, similarity: s1 === s2 ? 1 : 0 };
      if (method === "contains") return { contains: s1.includes(s2) || s2.includes(s1) };
      if (method === "similarity") return { similarity: levenshteinSimilarity(s1, s2) };
      return { equal: s1 === s2 };
    }
    case "compare_numbers": {
      const { number1, number2, tolerance = 0, operator = "==" } = opts;
      if (number1 === undefined || number2 === undefined) throw new Error("Both numbers are required");
      const n1 = Number(number1);
      const n2 = Number(number2);
      const diff = Math.abs(n1 - n2);
      let result = false;
      if (operator === "==") result = diff <= tolerance;
      else if (operator === "!=") result = diff > tolerance;
      else if (operator === ">") result = n1 > n2;
      else if (operator === ">=") result = n1 >= n2;
      else if (operator === "<") result = n1 < n2;
      else if (operator === "<=") result = n1 <= n2;
      return { result, difference: diff };
    }
    case "compare_dates": {
      const { date1, date2, operator = "==", tolerance_seconds = 0 } = opts;
      if (!date1 || !date2) throw new Error("Both dates are required");
      const d1 = new Date(date1).getTime();
      const d2 = new Date(date2).getTime();
      const diff = Math.abs(d1 - d2) / 1000;
      let result = false;
      if (operator === "==") result = diff <= tolerance_seconds;
      else if (operator === "!=") result = diff > tolerance_seconds;
      else if (operator === ">") result = d1 > d2;
      else if (operator === ">=") result = d1 >= d2;
      else if (operator === "<") result = d1 < d2;
      else if (operator === "<=") result = d1 <= d2;
      return { result, difference_seconds: diff };
    }
    case "is_changed": {
      const { value1, value2, deep = true, ignore_keys = [] } = opts;
      if (value1 === undefined || value2 === undefined) throw new Error("Both values are required");
      return { changed: deep ? !areDeepEqual(value1, value2, ignore_keys) : value1 !== value2 };
    }
    case "is_equal": {
      const { value1, value2, deep = true, strict = true, ignore_keys = [] } = opts;
      if (value1 === undefined || value2 === undefined) throw new Error("Both values are required");
      if (strict && !deep) return { equal: value1 === value2 };
      return { equal: deep ? areDeepEqual(value1, value2, ignore_keys) : value1 == value2 };
    }
    case "is_not_equal": {
      const { value1, value2, deep = true, strict = true, ignore_keys = [] } = opts;
      if (value1 === undefined || value2 === undefined) throw new Error("Both values are required");
      if (strict && !deep) return { not_equal: value1 !== value2 };
      const equal = deep ? areDeepEqual(value1, value2, ignore_keys) : value1 == value2;
      return { not_equal: !equal };
    }
    case "is_greater_than": {
      const { value1, value2, or_equal = false } = opts;
      if (value1 === undefined || value2 === undefined) throw new Error("Both values are required");
      return { result: or_equal ? value1 >= value2 : value1 > value2 };
    }
    case "is_less_than": {
      const { value1, value2, or_equal = false } = opts;
      if (value1 === undefined || value2 === undefined) throw new Error("Both values are required");
      return { result: or_equal ? value1 <= value2 : value1 < value2 };
    }
    case "is_between": {
      const { value, min, max, inclusive = true } = opts;
      if (value === undefined || min === undefined || max === undefined) throw new Error("Value, min, and max are required");
      return { result: inclusive ? value >= min && value <= max : value > min && value < max };
    }
    case "is_empty": {
      const { value, check_whitespace = true } = opts;
      if (value === undefined) throw new Error("Value is required");
      if (value == null) return { empty: true };
      if (Array.isArray(value)) return { empty: value.length === 0 };
      if (typeof value === "object") return { empty: Object.keys(value).length === 0 };
      if (typeof value === "string") return { empty: check_whitespace ? value.trim().length === 0 : value.length === 0 };
      return { empty: false };
    }
    case "is_null_or_undefined":
      return { is_null_or_undefined: opts.value == null };
    case "is_same_type": {
      const { value1, value2 } = opts;
      if (value1 === undefined || value2 === undefined) throw new Error("Both values are required");
      return { same_type: typeof value1 === typeof value2 };
    }
    case "deep_equal": {
      const { value1, value2, ignore_keys = [], ignore_order = false } = opts;
      if (value1 === undefined || value2 === undefined) throw new Error("Both values are required");
      if (ignore_order && Array.isArray(value1) && Array.isArray(value2)) {
        if (value1.length !== value2.length) return { equal: false };
        const sorted1 = [...value1].sort();
        const sorted2 = [...value2].sort();
        return { equal: areDeepEqual(sorted1, sorted2, ignore_keys) };
      }
      return { equal: areDeepEqual(value1, value2, ignore_keys) };
    }
    case "shallow_equal": {
      const { value1, value2 } = opts;
      if (value1 === undefined || value2 === undefined) throw new Error("Both values are required");
      return { equal: value1 === value2 };
    }
    case "similarity_score": {
      const { string1, string2, case_sensitive = false } = opts;
      if (!string1 || !string2) throw new Error("Both strings are required");
      const s1 = case_sensitive ? string1 : String(string1).toLowerCase();
      const s2 = case_sensitive ? string2 : String(string2).toLowerCase();
      return { similarity: levenshteinSimilarity(s1, s2) };
    }
    case "array_intersection": {
      const { array1, array2, deep = false, unique = true } = opts;
      if (!Array.isArray(array1) || !Array.isArray(array2)) throw new Error("Both arrays are required");
      const intersection: any[] = [];
      for (const item1 of array1) {
        if (array2.some((item2) => (deep ? areDeepEqual(item1, item2) : item1 === item2))) {
          if (unique && !intersection.some((item) => (deep ? areDeepEqual(item, item1) : item === item1))) intersection.push(item1);
          else if (!unique) intersection.push(item1);
        }
      }
      return { intersection };
    }
    case "array_union": {
      const { array1, array2, deep = false } = opts;
      if (!Array.isArray(array1) || !Array.isArray(array2)) throw new Error("Both arrays are required");
      const union: any[] = [...array1];
      for (const item2 of array2) {
        if (!union.some((item) => (deep ? areDeepEqual(item, item2) : item === item2))) union.push(item2);
      }
      return { union };
    }
    case "array_difference": {
      const { array1, array2, deep = false } = opts;
      if (!Array.isArray(array1) || !Array.isArray(array2)) throw new Error("Both arrays are required");
      const difference: any[] = [];
      for (const item1 of array1) {
        if (!array2.some((item2) => (deep ? areDeepEqual(item1, item2) : item1 === item2))) difference.push(item1);
      }
      return { difference };
    }
    default:
      throw new Error("Unsupported compare action: " + actionMethod);
  }
}

function executeGeo(opts: any, actionMethod: string): any {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const haversine = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };
  const equirectangular = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const avgLat = toRad((lat1 + lat2) / 2);
    const x = dLon * Math.cos(avgLat);
    const y = dLat;
    return R * Math.sqrt(x * x + y * y);
  };
  const conversions: Record<string, number> = {
    km: 1,
    miles: 0.621371,
    meters: 1000,
    feet: 3280.84,
    nautical_miles: 0.539957,
  };

  switch (actionMethod) {
    case "calculate_distance": {
      const { lat1, lon1, lat2, lon2, unit = "km", formula = "haversine" } = opts;
      if (lat1 === undefined || lon1 === undefined || lat2 === undefined || lon2 === undefined) throw new Error("All coordinates (lat1, lon1, lat2, lon2) are required");
      const distance = formula === "equirectangular" ? equirectangular(lat1, lon1, lat2, lon2) : haversine(lat1, lon1, lat2, lon2);
      return { distance: distance * (conversions[unit] || 1), unit };
    }
    case "point_in_polygon": {
      const { point_lat, point_lon, polygon, format = "lat_lon" } = opts;
      if (point_lat === undefined || point_lon === undefined || !Array.isArray(polygon)) throw new Error("Point coordinates and polygon array are required");
      const normalizedPolygon = polygon.map((point: any) => {
        if (format === "lon_lat" || format === "geojson") return [point[1], point[0]];
        return point;
      });
      let inside = false;
      for (let i = 0, j = normalizedPolygon.length - 1; i < normalizedPolygon.length; j = i++) {
        const [xi, yi] = normalizedPolygon[i];
        const [xj, yj] = normalizedPolygon[j];
        const intersect = yi > point_lat !== yj > point_lat && point_lon < ((xj - xi) * (point_lat - yi)) / (yj - yi) + xi;
        if (intersect) inside = !inside;
      }
      return { inside };
    }
    case "get_bounding_box": {
      const { points, format = "lat_lon", padding = 0, output_format = "bounds" } = opts;
      if (!Array.isArray(points) || points.length === 0) throw new Error("Points array is required and must not be empty");
      const normalizedPoints = points.map((point: any) => (format === "lon_lat" ? [point[1], point[0]] : point));
      let minLat = normalizedPoints[0][0];
      let maxLat = normalizedPoints[0][0];
      let minLon = normalizedPoints[0][1];
      let maxLon = normalizedPoints[0][1];
      for (const [lat, lon] of normalizedPoints) {
        minLat = Math.min(minLat, lat);
        maxLat = Math.max(maxLat, lat);
        minLon = Math.min(minLon, lon);
        maxLon = Math.max(maxLon, lon);
      }
      minLat -= padding;
      maxLat += padding;
      minLon -= padding;
      maxLon += padding;
      if (output_format === "bounds") return { north: maxLat, south: minLat, east: maxLon, west: minLon };
      if (output_format === "corners") return { corners: [[minLat, minLon], [minLat, maxLon], [maxLat, maxLon], [maxLat, minLon]] };
      return { type: "Polygon", coordinates: [[[minLon, minLat], [maxLon, minLat], [maxLon, maxLat], [minLon, maxLat], [minLon, minLat]]] };
    }
    case "reverse_geocode": {
      const { lat, lon, provider = "nominatim" } = opts;
      if (lat === undefined || lon === undefined) throw new Error("Latitude and longitude are required");
      return { address: `Location at ${lat}, ${lon}`, lat, lon, provider };
    }
    case "geocode": {
      const { address, provider = "nominatim", limit = 1 } = opts;
      if (!address) throw new Error("Address is required");
      return { results: [{ address, lat: 0, lon: 0, provider }], count: 1 };
    }
    case "convert_coordinates": {
      const { lat, lon, from_format = "decimal", to_format = "decimal", precision = 6 } = opts;
      if (lat === undefined || lon === undefined) throw new Error("Latitude and longitude are required");
      if (from_format === "decimal" && to_format === "decimal") return { lat: parseFloat(Number(lat).toFixed(precision)), lon: parseFloat(Number(lon).toFixed(precision)) };
      return { lat, lon, from_format, to_format, note: "Advanced conversions require additional implementation" };
    }
    default:
      throw new Error("Unsupported geo action: " + actionMethod);
  }
}

async function executeDateTime(opts: any, actionMethod: string): Promise<any> {
  const dayjs = (await import("dayjs")).default;
  const utc = (await import("dayjs/plugin/utc")).default;
  const timezone = (await import("dayjs/plugin/timezone")).default;
  const isLeapYear = (await import("dayjs/plugin/isLeapYear")).default;
  const isoWeek = (await import("dayjs/plugin/isoWeek")).default;
  const customParseFormat = (await import("dayjs/plugin/customParseFormat")).default;
  dayjs.extend(utc);
  dayjs.extend(timezone);
  dayjs.extend(isLeapYear);
  dayjs.extend(isoWeek);
  dayjs.extend(customParseFormat);

  switch (actionMethod) {
    case "get_current_date": {
      const { format = "YYYY-MM-DD", timezone: tz } = opts;
      let d = dayjs();
      if (tz) d = d.tz(tz);
      return { date: d.format(format) };
    }
    case "get_current_time": {
      const { format = "HH:mm:ss", timezone: tz } = opts;
      let d = dayjs();
      if (tz) d = d.tz(tz);
      return { time: d.format(format) };
    }
    case "get_current_datetime": {
      const { format = "YYYY-MM-DD HH:mm:ss", timezone: tz } = opts;
      let d = dayjs();
      if (tz) d = d.tz(tz);
      return { datetime: d.format(format), iso: d.toISOString() };
    }
    case "format":
    case "format_date": {
      const { date, format, input_format, timezone: tz } = opts;
      const value = date ?? opts.value ?? new Date().toISOString();
      if (!format) return { formatted: dayjs(value).toISOString() };
      let d = input_format ? dayjs(value, input_format) : dayjs(value);
      if (tz) d = d.tz(tz);
      return { formatted: d.format(format) };
    }
    case "parse_date": {
      const { date_string, format, timezone: tz } = opts;
      if (!date_string) throw new Error("Date string is required");
      let d = format ? dayjs(date_string, format) : dayjs(date_string);
      if (tz) d = d.tz(tz);
      return { parsed: d.toISOString(), timestamp: d.valueOf() };
    }
    case "add_time": {
      const { date, amount, unit, format } = opts;
      if (!date || amount === undefined || !unit) throw new Error("Date, amount, and unit are required");
      let d = dayjs(date).add(amount, unit);
      const result: any = { result: d.toISOString() };
      if (format) result.formatted = d.format(format);
      return result;
    }
    case "subtract_time": {
      const { date, amount, unit, format } = opts;
      if (!date || amount === undefined || !unit) throw new Error("Date, amount, and unit are required");
      let d = dayjs(date).subtract(amount, unit);
      const result: any = { result: d.toISOString() };
      if (format) result.formatted = d.format(format);
      return result;
    }
    case "diff_between_dates": {
      const { date1, date2, unit = "days", absolute = false } = opts;
      if (!date1 || !date2) throw new Error("Both dates are required");
      let diff = dayjs(date2).diff(dayjs(date1), unit);
      if (absolute) diff = Math.abs(diff);
      return { difference: diff, unit };
    }
    case "start_of_day": {
      const { date, format, timezone: tz } = opts;
      if (!date) throw new Error("Date is required");
      let d = dayjs(date).startOf("day");
      if (tz) d = d.tz(tz);
      const result: any = { result: d.toISOString() };
      if (format) result.formatted = d.format(format);
      return result;
    }
    case "end_of_day": {
      const { date, format, timezone: tz } = opts;
      if (!date) throw new Error("Date is required");
      let d = dayjs(date).endOf("day");
      if (tz) d = d.tz(tz);
      const result: any = { result: d.toISOString() };
      if (format) result.formatted = d.format(format);
      return result;
    }
    case "start_of_week": {
      const { date, week_start = "monday", format, timezone: tz } = opts;
      if (!date) throw new Error("Date is required");
      let d = week_start === "monday" ? dayjs(date).startOf("isoWeek") : dayjs(date).startOf("week");
      if (tz) d = d.tz(tz);
      const result: any = { result: d.toISOString() };
      if (format) result.formatted = d.format(format);
      return result;
    }
    case "end_of_week": {
      const { date, week_start = "monday", format, timezone: tz } = opts;
      if (!date) throw new Error("Date is required");
      let d = week_start === "monday" ? dayjs(date).endOf("isoWeek") : dayjs(date).endOf("week");
      if (tz) d = d.tz(tz);
      const result: any = { result: d.toISOString() };
      if (format) result.formatted = d.format(format);
      return result;
    }
    case "start_of_month": {
      const { date, format, timezone: tz } = opts;
      if (!date) throw new Error("Date is required");
      let d = dayjs(date).startOf("month");
      if (tz) d = d.tz(tz);
      const result: any = { result: d.toISOString() };
      if (format) result.formatted = d.format(format);
      return result;
    }
    case "end_of_month": {
      const { date, format, timezone: tz } = opts;
      if (!date) throw new Error("Date is required");
      let d = dayjs(date).endOf("month");
      if (tz) d = d.tz(tz);
      const result: any = { result: d.toISOString() };
      if (format) result.formatted = d.format(format);
      return result;
    }
    case "start_of_year": {
      const { date, format, timezone: tz } = opts;
      if (!date) throw new Error("Date is required");
      let d = dayjs(date).startOf("year");
      if (tz) d = d.tz(tz);
      const result: any = { result: d.toISOString() };
      if (format) result.formatted = d.format(format);
      return result;
    }
    case "end_of_year": {
      const { date, format, timezone: tz } = opts;
      if (!date) throw new Error("Date is required");
      let d = dayjs(date).endOf("year");
      if (tz) d = d.tz(tz);
      const result: any = { result: d.toISOString() };
      if (format) result.formatted = d.format(format);
      return result;
    }
    case "convert_timezone": {
      const { date, from_timezone, to_timezone, format } = opts;
      if (!date || !to_timezone) throw new Error("Date and to_timezone are required");
      let d = from_timezone ? dayjs.tz(date, from_timezone) : dayjs(date);
      d = d.tz(to_timezone);
      const result: any = { result: d.toISOString() };
      if (format) result.formatted = d.format(format);
      return result;
    }
    case "get_timezone": {
      const { date } = opts;
      const d = date ? dayjs(date) : dayjs();
      return { timezone: d.format("z"), offset: d.utcOffset() };
    }
    case "list_timezones": {
      const { filter } = opts;
      let timezones: string[] = (dayjs.tz as any).names();
      if (filter) timezones = timezones.filter((tz) => tz.toLowerCase().includes(filter.toLowerCase()));
      return { timezones };
    }
    case "is_leap_year": {
      const { year, date } = opts;
      const y = year || (date ? dayjs(date).year() : dayjs().year());
      return { is_leap_year: dayjs().year(y).isLeapYear(), year: y };
    }
    case "get_unix_timestamp": {
      const { date, unit = "seconds" } = opts;
      const d = date ? dayjs(date) : dayjs();
      const timestamp = unit === "milliseconds" ? d.valueOf() : d.unix();
      return { timestamp, unit };
    }
    case "from_unix_timestamp": {
      const { timestamp, unit = "seconds", format, timezone: tz } = opts;
      if (timestamp === undefined) throw new Error("Timestamp is required");
      let d = unit === "milliseconds" ? dayjs(timestamp) : dayjs.unix(timestamp);
      if (tz) d = d.tz(tz);
      const result: any = { result: d.toISOString() };
      if (format) result.formatted = d.format(format);
      return result;
    }
    default: {
      const now = dayjs();
      return { datetime: now.format("YYYY-MM-DD HH:mm:ss"), iso: now.toISOString() };
    }
  }
}

async function executeUtilityConnector(
  connectorDef: ConnectorDef,
  actionName: string,
  options: ExecOptions,
  context: any
): Promise<any> {
  const utilityType = connectorDef._id?.split(".").pop() || connectorDef._id?.split(".")[1] || "string";
  const opts = options.body || options;
  const actionMethod = actionName.split(".").pop() || actionName;
  let result: any;
  if (utilityType === "date_time") {
    result = await executeDateTime(opts, actionMethod);
  } else if (utilityType === "compare") {
    result = executeCompare(opts, actionMethod);
  } else if (utilityType === "geo") {
    result = executeGeo(opts, actionMethod);
  } else if (utilityType === "string") {
    result = executeString(opts, actionMethod);
  } else if (utilityType === "random") {
    result = executeRandom(opts, actionMethod);
  } else if (utilityType === "math") {
    result = executeMath(opts, actionMethod);
  } else {
    result = { value: opts.value ?? null };
  }
  const mapped =
    result.value !== undefined
      ? result.value
      : result.formatted !== undefined
        ? result.formatted
        : result.datetime !== undefined
          ? result.datetime
          : result.date !== undefined
            ? result.date
            : result.time !== undefined
              ? result.time
              : result;
  return { raw: result, mapped };
}

async function executeEncryptionConnector(
  connectorDef: ConnectorDef,
  actionName: string,
  options: ExecOptions,
  context: any
): Promise<any> {
  const crypto = await import("crypto");
  const encType = connectorDef._id?.split(".")[0] || "base64";
  const opts = options.body || options;
  const data = opts.data ?? opts.value ?? opts.string ?? "";
  const str = typeof data === "string" ? data : JSON.stringify(data);
  let result: any;

  if (encType === "base64") {
    const method = actionName.split(".").pop() || "encode";
    if (method === "encode") {
      const toEncode = opts.data ?? data;
      const inputStr = typeof toEncode === "string" ? toEncode : JSON.stringify(toEncode);
      result = { value: Buffer.from(inputStr, "utf-8").toString("base64") };
    } else {
      const encoded = opts.encoded_data ?? opts.data ?? data;
      result = { value: Buffer.from(String(encoded || ""), "base64").toString("utf-8") };
    }
  } else if (encType === "hash") {
    const algo = opts.algorithm || (actionName.includes(".") ? actionName.split(".").pop() : "sha256") || "sha256";
    const outFmt = opts.output_format || "hex";
    const hash = crypto.createHash(algo).update(str).digest();
    const value = outFmt === "base64" ? hash.toString("base64") : hash.toString("hex");
    result = { value, hash: value, algorithm: algo, output_format: outFmt };
  } else if (encType === "aes") {
    result = await executeAes(crypto, actionName, opts, str);
  } else if (encType === "rsa") {
    result = await executeRsa(crypto, actionName, opts, str);
  } else if (encType === "hmac") {
    result = await executeHmac(crypto, actionName, opts, str);
  } else if (encType === "password") {
    result = await executePassword(actionName, opts, str);
  } else {
    result = { value: str };
  }
  const mapped = result.value !== undefined ? result.value : result;
  return { raw: result, mapped };
}

async function executeAes(crypto: typeof import("crypto"), actionName: string, opts: any, str: string): Promise<any> {
  const action = actionName.split(".").pop() || "";
  if (action === "encrypt") {
    const key = opts.key;
    if (!key) throw new Error("Key is required for AES encryption");
    const algorithm = opts.algorithm || "aes-256-cbc";
    const outputFormat = opts.output_format || "hex";
    let ivBuffer: Buffer;
    if (opts.iv) {
      ivBuffer = Buffer.from(opts.iv, "hex");
    } else {
      ivBuffer = crypto.randomBytes(16);
    }
    const keyBuffer = Buffer.from(key, "utf8");
    const cipher = crypto.createCipheriv(algorithm, keyBuffer, ivBuffer);
    let encrypted = cipher.update(str, "utf8");
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    const encryptedData = outputFormat === "base64" ? encrypted.toString("base64") : encrypted.toString("hex");
    return { value: encryptedData, encrypted_data: encryptedData, iv: ivBuffer.toString("hex"), algorithm, output_format: outputFormat };
  }
  if (action === "decrypt") {
    const key = opts.key;
    const encryptedData = opts.encrypted_data || str;
    if (!key) throw new Error("Key is required for AES decryption");
    if (!encryptedData) throw new Error("Encrypted data is required");
    const algorithm = opts.algorithm || "aes-256-cbc";
    const inputFormat = opts.input_format || "hex";
    const iv = opts.iv;
    if (!iv && algorithm.includes("cbc")) throw new Error("IV is required for CBC decryption");
    const keyBuffer = Buffer.from(key, "utf8");
    const ivBuffer = iv ? Buffer.from(iv, "hex") : crypto.randomBytes(16);
    const encryptedBuffer = inputFormat === "base64" ? Buffer.from(encryptedData, "base64") : Buffer.from(encryptedData, "hex");
    const decipher = crypto.createDecipheriv(algorithm, keyBuffer, ivBuffer);
    let decrypted = decipher.update(encryptedBuffer);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return { value: decrypted.toString("utf8"), decrypted_data: decrypted.toString("utf8"), algorithm };
  }
  if (action === "generate_key") {
    const keyLength = opts.key_length ?? 32;
    const outputFormat = opts.output_format || "hex";
    const key = crypto.randomBytes(keyLength);
    const value = outputFormat === "base64" ? key.toString("base64") : key.toString("hex");
    return { value, key: value, key_length: keyLength, output_format: outputFormat };
  }
  if (action === "generate_iv") {
    const length = opts.length ?? 16;
    const outputFormat = opts.output_format || "hex";
    const iv = crypto.randomBytes(length);
    const value = outputFormat === "base64" ? iv.toString("base64") : iv.toString("hex");
    return { value, iv: value, length, output_format: outputFormat };
  }
  return { value: str };
}

async function executeRsa(crypto: typeof import("crypto"), actionName: string, opts: any, str: string): Promise<any> {
  const action = actionName.split(".").pop() || "";
  if (action === "generate_keypair") {
    const modulusLength = opts.modulus_length ?? 2048;
    const publicKeyFormat = opts.public_key_format || "pem";
    const privateKeyFormat = opts.private_key_format || "pem";
    const publicKeyType = publicKeyFormat === "pkcs1" ? "pkcs1" : "spki";
    const privateKeyType = privateKeyFormat === "pkcs1" ? "pkcs1" : "pkcs8";
    const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
      modulusLength,
      publicKeyEncoding: { type: publicKeyType, format: "pem" },
      privateKeyEncoding: { type: privateKeyType, format: "pem" },
    });
    return { value: { public_key: publicKey, private_key: privateKey }, public_key: publicKey, private_key: privateKey, modulus_length: modulusLength };
  }
  if (action === "encrypt") {
    const data = opts.data ?? str;
    const publicKey = opts.public_key;
    if (!publicKey) throw new Error("Public key is required for RSA encryption");
    const padding = opts.padding || "RSA_PKCS1_OAEP_PADDING";
    const outputFormat = opts.output_format || "base64";
    const paddingConst = padding === "RSA_PKCS1_PADDING" ? crypto.constants.RSA_PKCS1_PADDING : padding === "RSA_NO_PADDING" ? crypto.constants.RSA_NO_PADDING : crypto.constants.RSA_PKCS1_OAEP_PADDING;
    const dataStr = typeof data === "string" ? data : JSON.stringify(data);
    const encrypted = crypto.publicEncrypt({ key: publicKey, padding: paddingConst }, Buffer.from(dataStr, "utf8"));
    const value = outputFormat === "hex" ? encrypted.toString("hex") : encrypted.toString("base64");
    return { value, encrypted_data: value, padding, output_format: outputFormat };
  }
  if (action === "decrypt") {
    const encryptedData = opts.encrypted_data ?? str;
    const privateKey = opts.private_key;
    if (!privateKey) throw new Error("Private key is required for RSA decryption");
    const padding = opts.padding || "RSA_PKCS1_OAEP_PADDING";
    const inputFormat = opts.input_format || "base64";
    const paddingConst = padding === "RSA_PKCS1_PADDING" ? crypto.constants.RSA_PKCS1_PADDING : padding === "RSA_NO_PADDING" ? crypto.constants.RSA_NO_PADDING : crypto.constants.RSA_PKCS1_OAEP_PADDING;
    const encryptedBuffer = inputFormat === "hex" ? Buffer.from(encryptedData, "hex") : Buffer.from(encryptedData, "base64");
    const decrypted = crypto.privateDecrypt({ key: privateKey, padding: paddingConst }, encryptedBuffer);
    const value = decrypted.toString("utf8");
    return { value, decrypted_data: value, padding };
  }
  if (action === "sign") {
    const data = opts.data ?? str;
    const privateKey = opts.private_key;
    if (!privateKey) throw new Error("Private key is required for RSA signing");
    const algorithm = opts.algorithm || "RSA-SHA256";
    const dataStr = typeof data === "string" ? data : JSON.stringify(data);
    const sign = crypto.createSign(algorithm);
    sign.update(dataStr);
    const signature = sign.sign(privateKey, "base64");
    return { value: signature, signature, algorithm };
  }
  if (action === "verify") {
    const data = opts.data ?? str;
    const signature = opts.signature;
    const publicKey = opts.public_key;
    if (!signature) throw new Error("Signature is required for RSA verification");
    if (!publicKey) throw new Error("Public key is required for RSA verification");
    const algorithm = opts.algorithm || "RSA-SHA256";
    const dataStr = typeof data === "string" ? data : JSON.stringify(data);
    const verify = crypto.createVerify(algorithm);
    verify.update(dataStr);
    const valid = verify.verify(publicKey, signature, "base64");
    return { value: valid, valid, algorithm };
  }
  return { value: str };
}

async function executeHmac(crypto: typeof import("crypto"), actionName: string, opts: any, str: string): Promise<any> {
  const action = actionName.split(".").pop() || "";
  const key = opts.key;
  if (!key) throw new Error("Key is required for HMAC");
  const algorithm = opts.algorithm || "sha256";
  const data = opts.data ?? str;
  const dataStr = typeof data === "string" ? data : JSON.stringify(data);

  if (action === "create") {
    const outputFormat = opts.output_format || "hex";
    const hmac = crypto.createHmac(algorithm, key);
    hmac.update(dataStr);
    const hmacValue = hmac.digest();
    const value = outputFormat === "base64" ? hmacValue.toString("base64") : hmacValue.toString("hex");
    return { value, hmac: value, algorithm, output_format: outputFormat };
  }
  if (action === "verify") {
    const providedHmac = opts.hmac;
    if (!providedHmac) throw new Error("HMAC is required for verification");
    const inputFormat = opts.input_format || "hex";
    const hmac = crypto.createHmac(algorithm, key);
    hmac.update(dataStr);
    const computedHash = hmac.digest();
    const computedHmac = inputFormat === "base64" ? computedHash.toString("base64") : computedHash.toString("hex");
    const valid = computedHmac === providedHmac;
    return { value: valid, valid, algorithm };
  }
  return { value: str };
}

async function executePassword(actionName: string, opts: any, str: string): Promise<any> {
  const crypto = await import("crypto");
  const action = actionName.split(".").pop() || "";
  const password = opts.password ?? str;
  const pepper = opts.pepper;

  if (action === "argon2_hash") {
    let argon2: any;
    try {
      argon2 = await import("argon2");
    } catch {
      throw new Error("argon2 package is required for argon2_hash. Install with: npm install argon2");
    }
    const type = opts.type || "argon2id";
    const memoryCost = opts.memoryCost ?? 65536;
    const timeCost = opts.timeCost ?? 3;
    const parallelism = opts.parallelism ?? 4;
    const passwordWithPepper = pepper ? pepper + password : password;
    const hash = await argon2.hash(passwordWithPepper, {
      type: type === "argon2i" ? argon2.argon2i : type === "argon2d" ? argon2.argon2d : argon2.argon2id,
      memoryCost,
      timeCost,
      parallelism,
    });
    return { value: hash, hash, type, memoryCost, timeCost, parallelism };
  }
  if (action === "argon2_verify") {
    let argon2: any;
    try {
      argon2 = await import("argon2");
    } catch {
      throw new Error("argon2 package is required for argon2_verify. Install with: npm install argon2");
    }
    const hash = opts.hash;
    if (!hash) throw new Error("Hash is required for argon2 verification");
    const passwordWithPepper = pepper ? pepper + password : password;
    try {
      const valid = await argon2.verify(hash, passwordWithPepper);
      return { value: valid, valid };
    } catch {
      return { value: false, valid: false };
    }
  }
  if (action === "pbkdf2_hash") {
    const salt = opts.salt ?? crypto.randomBytes(32).toString("hex");
    const iterations = opts.iterations ?? 100000;
    const keylen = opts.keylen ?? 64;
    const digest = opts.digest || "sha256";
    const outputFormat = opts.output_format || "hex";
    const passwordWithPepper = pepper ? pepper + password : password;
    const derivedKey = crypto.pbkdf2Sync(passwordWithPepper, salt, iterations, keylen, digest);
    const hash = outputFormat === "base64" ? derivedKey.toString("base64") : derivedKey.toString("hex");
    return { value: hash, hash, salt, iterations, keylen, digest, output_format: outputFormat };
  }
  if (action === "pbkdf2_verify") {
    const hash = opts.hash;
    const salt = opts.salt;
    if (!hash || !salt) throw new Error("Hash and salt are required for PBKDF2 verification");
    const iterations = opts.iterations ?? 100000;
    const keylen = opts.keylen ?? 64;
    const digest = opts.digest || "sha256";
    const outputFormat = opts.output_format || "hex";
    const passwordWithPepper = pepper ? pepper + password : password;
    const derivedKey = crypto.pbkdf2Sync(passwordWithPepper, salt, iterations, keylen, digest);
    const computedHash = outputFormat === "base64" ? derivedKey.toString("base64") : derivedKey.toString("hex");
    const valid = computedHash === hash;
    return { value: valid, valid };
  }
  if (action === "scrypt_hash") {
    const salt = opts.salt ?? crypto.randomBytes(32).toString("hex");
    const keylen = opts.keylen ?? 64;
    const cost = opts.cost ?? 16384;
    const blockSize = opts.blockSize ?? 8;
    const parallelization = opts.parallelization ?? 1;
    const outputFormat = opts.output_format || "hex";
    const passwordWithPepper = pepper ? pepper + password : password;
    const derivedKey = crypto.scryptSync(passwordWithPepper, salt, keylen, { cost, blockSize, maxmem: 128 * cost * blockSize });
    const hash = outputFormat === "base64" ? derivedKey.toString("base64") : derivedKey.toString("hex");
    return { value: hash, hash, salt, keylen, cost, blockSize, parallelization, output_format: outputFormat };
  }
  if (action === "scrypt_verify") {
    const hash = opts.hash;
    const salt = opts.salt;
    if (!hash || !salt) throw new Error("Hash and salt are required for scrypt verification");
    const keylen = opts.keylen ?? 64;
    const cost = opts.cost ?? 16384;
    const blockSize = opts.blockSize ?? 8;
    const outputFormat = opts.output_format || "hex";
    const passwordWithPepper = pepper ? pepper + password : password;
    const derivedKey = crypto.scryptSync(passwordWithPepper, salt, keylen, { cost, blockSize, maxmem: 128 * cost * blockSize });
    const computedHash = outputFormat === "base64" ? derivedKey.toString("base64") : derivedKey.toString("hex");
    const valid = computedHash === hash;
    return { value: valid, valid };
  }
  if (action === "bcrypt_hash") {
    let bcrypt: any;
    try {
      bcrypt = await import("bcrypt");
    } catch {
      throw new Error("bcrypt package is required for bcrypt_hash. Install with: npm install bcrypt");
    }
    const rounds = opts.rounds ?? 10;
    const passwordWithPepper = pepper ? pepper + password : password;
    const hash = await bcrypt.hash(passwordWithPepper, rounds);
    return { value: hash, hash, rounds };
  }
  if (action === "bcrypt_verify") {
    let bcrypt: any;
    try {
      bcrypt = await import("bcrypt");
    } catch {
      throw new Error("bcrypt package is required for bcrypt_verify. Install with: npm install bcrypt");
    }
    const hash = opts.hash;
    if (!hash) throw new Error("Hash is required for bcrypt verification");
    const passwordWithPepper = pepper ? pepper + password : password;
    try {
      const valid = await bcrypt.compare(passwordWithPepper, hash);
      return { value: valid, valid };
    } catch {
      return { value: false, valid: false };
    }
  }
  if (action === "generate_salt") {
    const length = opts.length ?? 32;
    const outputFormat = opts.output_format || "hex";
    const salt = crypto.randomBytes(length);
    const value = outputFormat === "base64" ? salt.toString("base64") : salt.toString("hex");
    return { value, salt: value, length, output_format: outputFormat };
  }
  return { value: str };
}

function resolveRegisteredRestActionName(connectorDef: ConnectorDef, actionName: string): string | null {
  const endpoints = connectorDef.endpoints || [];
  if (!endpoints.length) return null;
  if (endpoints.some((e: any) => e.name === actionName || e.action === actionName)) {
    return actionName;
  }
  const actions = connectorDef.actions;
  if (actions && typeof actions === "object" && !Array.isArray(actions) && Object.prototype.hasOwnProperty.call(actions, actionName)) {
    const mapped = actions[actionName];
    if (
      typeof mapped === "string" &&
      endpoints.some((e: any) => e.name === mapped || e.action === mapped)
    ) {
      return mapped;
    }
  }
  return null;
}

export async function executeConnectorAction(
  connectorDef: ConnectorDef,
  actionName: string,
  options: ExecOptions = {},
  context: any = {}
): Promise<any> {
  const restActionName = resolveRegisteredRestActionName(connectorDef, actionName);
  if (
    restActionName &&
    (connectorDef.type === "REST" || connectorDef.type === "rest" || connectorDef.endpoints?.length)
  ) {
    return executeRestConnector(connectorDef, restActionName, options, context);
  }

  if (typeof connectorDef.execute === "function") {
    const result = await connectorDef.execute(actionName, options, context);
    return { raw: result, mapped: result };
  }

  const category = connectorDef.meta?.category;

  if (category === "responder") {
    return executeResponder(connectorDef, options, context);
  }

  if (category === "database") {
    return executeDbConnector(connectorDef, actionName, options, context);
  }

  if (category === "authentication") {
    return executeAuthConnector(connectorDef, actionName, options, context);
  }

  if (category === "utility") {
    return executeUtilityConnector(connectorDef, actionName, options, context);
  }

  if (category === "encryption") {
    return executeEncryptionConnector(connectorDef, actionName, options, context);
  }

  if (connectorDef.type === "REST" || connectorDef.type === "rest" || connectorDef.endpoints) {
    return executeRestConnector(connectorDef, actionName, options, context);
  }

  throw new Error("Unsupported connector: " + (connectorDef._id || connectorDef.id));
}
