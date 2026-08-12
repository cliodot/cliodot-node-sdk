import axios, { AxiosInstance } from "axios";
import { CliodotApiError, cliodotApiErrorFromAxios } from "./errors";
import { parseApiErrorCode, parseApiErrorMessage } from "./http/parse-api-error";
import type {
  EventListenHandle,
  EventListenHandler,
  EventListenMessage,
  EventListenOptions,
  EventPublishOptions,
  EventPublishResponse,
  EventsApi,
  EventsConfig,
  EventSubscribeInput,
  EventSubscribeResponse,
  EventUnsubscribeResponse,
} from "./types/event-app.api";

function trimBaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

function sanitizeEventApiErrorMessage(
  message: string,
  code?: string
): string {
  if (code === "EVENT_DELIVERY_PROFILE_NOT_READY") {
    return message;
  }
  if (
    /kafka|rabbitmq|redis.?streams|bullmq|nats|broker|KAFKA_|RABBITMQ_|REDIS_STREAMS_/i.test(
      message
    )
  ) {
    return "Delivery profile is not ready. Contact your administrator.";
  }
  return message;
}

export class Events implements EventsApi {
  private readonly baseUrl: string;
  private readonly appId: string;
  private readonly apiKey?: string;
  private readonly appSecret?: string;
  private readonly axios: AxiosInstance;
  public readonly debug: boolean;

  constructor(config: EventsConfig) {
    if (!config.baseUrl?.trim()) {
      throw new CliodotApiError("Events requires baseUrl");
    }
    if (!config.appId?.trim()) {
      throw new CliodotApiError("Events requires appId");
    }
    this.baseUrl = trimBaseUrl(config.baseUrl);
    this.appId = config.appId.trim();
    this.apiKey =
      config.apiKey?.trim() || config.appApiKey?.trim() || undefined;
    this.appSecret = config.appSecret?.trim() || undefined;
    this.debug = config.debug ?? false;
    this.axios = axios.create({
      baseURL: `${this.baseUrl}/event`,
      timeout: 30000,
      headers: { "Content-Type": "application/json" },
    });
  }

  publish(
    event: string,
    payload: unknown,
    options: EventPublishOptions = {}
  ): Promise<EventPublishResponse> {
    if (!event?.trim()) {
      throw new CliodotApiError("event is required");
    }
    const body: Record<string, unknown> = {
      event: event.trim(),
      payload,
    };
    if (options.ordering_key !== undefined) {
      body.ordering_key = options.ordering_key;
    }
    if (options.delay_ms !== undefined) {
      body.delay_ms = options.delay_ms;
    }
    if (options.run_at !== undefined) {
      body.run_at =
        options.run_at instanceof Date
          ? options.run_at.toISOString()
          : options.run_at;
    }
    if (options.id !== undefined) {
      body.id = options.id;
    }
    if (options.publisher_id !== undefined) {
      body.publisher_id = options.publisher_id;
    }
    if (options.metadata !== undefined) {
      body.metadata = options.metadata;
    }
    if (options.environment !== undefined) {
      body.environment = options.environment;
    }
    return this.request<EventPublishResponse>("POST", "/v1/publish", body);
  }

  subscribe(input: EventSubscribeInput): Promise<EventSubscribeResponse> {
    if (!Array.isArray(input?.events) || input.events.length === 0) {
      throw new CliodotApiError("events is required");
    }
    const body: Record<string, unknown> = {
      events: input.events.map((e) => String(e).trim()).filter(Boolean),
    };
    if (input.name?.trim()) {
      body.name = input.name.trim();
    }
    return this.request<EventSubscribeResponse>("POST", "/v1/subscribe", body);
  }

  unsubscribe(subscriptionId: string): Promise<EventUnsubscribeResponse> {
    if (!subscriptionId?.trim()) {
      throw new CliodotApiError("subscriptionId is required");
    }
    return this.request<EventUnsubscribeResponse>(
      "DELETE",
      `/v1/subscribe/${encodeURIComponent(subscriptionId.trim())}`
    );
  }

  listenUrl(options: EventListenOptions = {}): string {
    const params = new URLSearchParams();
    params.set("app_id", this.appId);
    const token = this.apiKey || this.appSecret;
    if (!token) {
      throw new CliodotApiError(
        "Events credentials required (apiKey/appApiKey or appSecret)"
      );
    }
    params.set("access_token", token);
    if (options.subscription_id?.trim()) {
      params.set("subscription_id", options.subscription_id.trim());
    } else if (options.events?.length) {
      params.set(
        "events",
        options.events.map((e) => String(e).trim()).filter(Boolean).join(",")
      );
    }
    return `${this.baseUrl}/event/v1/listen?${params.toString()}`;
  }

  listen(
    options: EventListenOptions,
    handler: EventListenHandler
  ): EventListenHandle {
    if (typeof handler !== "function") {
      throw new CliodotApiError("listen handler is required");
    }
    if (!options?.subscription_id?.trim() && !options?.events?.length) {
      throw new CliodotApiError(
        "listen requires events or subscription_id"
      );
    }

    const params: Record<string, string> = {};
    if (options.subscription_id?.trim()) {
      params.subscription_id = options.subscription_id.trim();
    } else if (options.events?.length) {
      params.events = options.events
        .map((e) => String(e).trim())
        .filter(Boolean)
        .join(",");
    }

    const reconnect = options.reconnect !== false;
    const initialDelayMs = Math.max(100, options.reconnectDelayMs ?? 1000);
    const maxDelayMs = Math.max(
      initialDelayMs,
      options.reconnectMaxDelayMs ?? 30000
    );

    let closed = false;
    let controller: AbortController | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let attempt = 0;
    let buffer = "";

    const clearReconnectTimer = () => {
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
    };

    const close = () => {
      if (closed) return;
      closed = true;
      clearReconnectTimer();
      controller?.abort();
      controller = null;
    };

    const scheduleReconnect = () => {
      if (closed || !reconnect) return;
      clearReconnectTimer();
      const delay = Math.min(
        maxDelayMs,
        initialDelayMs * Math.pow(2, Math.min(attempt, 8))
      );
      attempt += 1;
      if (this.debug) {
        console.warn(
          `[Events] listen disconnected; reconnecting in ${delay}ms (attempt ${attempt})`
        );
      }
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        if (!closed) {
          void connect();
        }
      }, delay);
    };

    const connect = async () => {
      if (closed) return;
      controller?.abort();
      controller = new AbortController();
      buffer = "";
      const signal = controller.signal;

      try {
        const response = await this.axios({
          method: "GET",
          url: "/v1/listen",
          headers: {
            ...this.buildAuthHeaders(),
            Accept: "text/event-stream",
          },
          params,
          responseType: "stream",
          signal,
          timeout: 0,
        });

        if (closed) {
          const stream = response.data as any;
          if (typeof stream.destroy === "function") {
            stream.destroy();
          }
          return;
        }

        attempt = 0;
        const stream = response.data as any;

        await new Promise<void>((resolve) => {
          const onData = (chunk: Buffer | string) => {
            if (closed) return;
            buffer +=
              typeof chunk === "string" ? chunk : chunk.toString("utf8");
            const parts = buffer.split("\n");
            buffer = parts.pop() ?? "";
            for (const line of parts) {
              const trimmed = line.trimEnd();
              if (!trimmed || trimmed.startsWith(":")) continue;
              if (!trimmed.startsWith("data:")) continue;
              const raw = trimmed.slice(5).trim();
              if (!raw) continue;
              try {
                const message = JSON.parse(raw) as EventListenMessage;
                handler(message);
              } catch {
                if (this.debug) {
                  console.warn("[Events] failed to parse SSE data", raw);
                }
              }
            }
          };

          const cleanup = () => {
            stream.off("data", onData);
            stream.off("error", onError);
            stream.off("end", onEnd);
            stream.off("close", onEnd);
          };

          const onError = (err: Error) => {
            cleanup();
            if (closed || (err as any)?.name === "AbortError") {
              resolve();
              return;
            }
            if (this.debug) {
              console.error("[Events] listen stream error", err);
            }
            resolve();
          };

          const onEnd = () => {
            cleanup();
            resolve();
          };

          stream.on("data", onData);
          stream.on("error", onError);
          stream.on("end", onEnd);
          stream.on("close", onEnd);
        });

        if (!closed) {
          scheduleReconnect();
        }
      } catch (err: any) {
        if (
          closed ||
          err?.name === "AbortError" ||
          err?.code === "ERR_CANCELED"
        ) {
          return;
        }
        if (this.debug) {
          console.error("[Events] listen failed", err);
        }
        scheduleReconnect();
      }
    };

    void connect();

    return { close };
  }

  private buildAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      "x-cliodot-app-id": this.appId,
    };
    if (this.apiKey) {
      headers.Authorization = `Bearer ${this.apiKey}`;
      return headers;
    }
    if (this.appSecret) {
      headers["x-cliodot-app-secret"] = this.appSecret;
      return headers;
    }
    throw new CliodotApiError(
      "Events credentials required (apiKey/appApiKey or appSecret)"
    );
  }

  private async request<T>(
    method: string,
    path: string,
    body?: Record<string, unknown>
  ): Promise<T> {
    try {
      const { data } = await this.axios({
        method,
        url: path,
        headers: this.buildAuthHeaders(),
        data: body,
      });
      if (data?.ok === false) {
        const code = parseApiErrorCode(data);
        throw new CliodotApiError(
          sanitizeEventApiErrorMessage(
            parseApiErrorMessage(data) || "Event request failed",
            code
          ),
          {
            data,
            code,
          }
        );
      }
      return data as T;
    } catch (err: any) {
      if (err instanceof CliodotApiError) {
        throw err;
      }
      const apiErr = cliodotApiErrorFromAxios(
        err,
        `Request failed: ${method} ${path}`
      );
      throw new CliodotApiError(
        sanitizeEventApiErrorMessage(apiErr.message, apiErr.code),
        {
          status: apiErr.status,
          data: apiErr.data,
          code:
            apiErr.code ||
            (/kafka|rabbitmq|redis.?streams|bullmq|broker|KAFKA_|RABBITMQ_/i.test(
              apiErr.message
            )
              ? "EVENT_DELIVERY_PROFILE_NOT_READY"
              : apiErr.code),
        }
      );
    }
  }
}
