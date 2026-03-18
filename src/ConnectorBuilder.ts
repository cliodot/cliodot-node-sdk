type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface EndpointOpts {
  action?: string;
  params?: Record<string, any>;
  pathParams?: Record<string, any>;
  body?: any;
  headers?: Record<string, string>;
  description?: string;
  timeout_ms?: number;
  response_mapping?: Record<string, string>;
  body_schema?: Record<string, any>;
}

export interface CustomAuthFlow {
  method?: string;
  url: string;
  headers?: Record<string, string>;
  body?: Record<string, any>;
  extract_token?: string;
  extract_expires_in?: string;
  token_location?: "header" | "query" | "body";
  token_template_prefix?: string;
}

interface AuthDef {
  type: string;
  token?: string;
  api_key?: string;
  key_name?: string;
  header_name?: string;
  prefix?: string;
  flow?: CustomAuthFlow;
}

interface MetaDef {
  category?: string;
  logo?: string;
  [key: string]: any;
}

export class ConnectorBuilder {
  private _id: string;
  private _name: string;
  private _slug?: string;
  private _description?: string;
  private _type: string = "REST";
  private _baseUrl: string = "";
  private _auth: AuthDef = { type: "bearer" };
  private _meta?: MetaDef;
  private _endpoints: Array<EndpointOpts & { name: string; method: string; path: string }> = [];

  constructor(id: string, name?: string) {
    this._id = id;
    this._name = name ?? id;
  }

  rest(): this {
    this._type = "REST";
    return this;
  }

  baseUrl(url: string): this {
    this._baseUrl = url;
    return this;
  }

  bearer(token: string): this {
    this._auth = { type: "bearer", token };
    return this;
  }

  apiKey(key: string, keyName?: string): this {
    this._auth = { type: "api_key", api_key: key, key_name: keyName };
    return this;
  }

  botToken(token: string, prefix = "Bot "): this {
    this._auth = { type: "bearer", token, header_name: "Authorization", prefix };
    return this;
  }

  customFlow(flow: CustomAuthFlow): this {
    this._auth = { type: "custom", flow };
    return this;
  }

  authConfig(auth: AuthDef): this {
    this._auth = auth;
    return this;
  }

  description(desc: string): this {
    this._description = desc;
    return this;
  }

  slug(s: string): this {
    this._slug = s;
    return this;
  }

  meta(m: MetaDef): this {
    this._meta = m;
    return this;
  }

  endpoint(name: string, method: HttpMethod | string, path: string, opts?: EndpointOpts): this {
    this._endpoints.push({
      name,
      // action: opts?.action ?? name,
      method: (method || "GET").toUpperCase(),
      path,
      ...opts,
    });
    return this;
  }

  get(name: string, path: string, opts?: EndpointOpts): this {
    return this.endpoint(name, "GET", path, opts);
  }

  post(name: string, path: string, opts?: EndpointOpts): this {
    return this.endpoint(name, "POST", path, opts);
  }

  put(name: string, path: string, opts?: EndpointOpts): this {
    return this.endpoint(name, "PUT", path, opts);
  }

  patch(name: string, path: string, opts?: EndpointOpts): this {
    return this.endpoint(name, "PATCH", path, opts);
  }

  delete(name: string, path: string, opts?: EndpointOpts): this {
    return this.endpoint(name, "DELETE", path, opts);
  }

  build(): Record<string, any> {
    const out: Record<string, any> = {
      _id: this._id,
      type: this._type,
      name: this._name,
      base_url: this._baseUrl,
      auth: this._auth,
      endpoints: this._endpoints,
    };
    if (this._slug) out.slug = this._slug;
    if (this._description) out.description = this._description;
    if (this._meta) {
      out.meta = {
        ...this._meta,
        last_updated: this._meta.last_updated ?? new Date().toISOString(),
      };
    }
    return out;
  }
}

export function connector(id: string, name?: string): ConnectorBuilder {
  return new ConnectorBuilder(id, name);
}
