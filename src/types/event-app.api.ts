export type EventsConfig = {
  baseUrl: string;
  appId: string;
  apiKey?: string;
  appApiKey?: string;
  appSecret?: string;
  debug?: boolean;
};

export type EventPublishOptions = {
  ordering_key?: string;
  delay_ms?: number;
  run_at?: string | Date;
  id?: string;
  publisher_id?: string;
  metadata?: Record<string, unknown>;
};

export type EventPublishResponse = {
  ok: true;
  event_id: string;
  accepted: true;
};

export type EventSubscribeInput = {
  events: string[];
  name?: string;
};

export type EventSubscribeResponse = {
  ok: true;
  subscription_id: string;
  events: string[];
};

export type EventUnsubscribeResponse = {
  ok: true;
  deleted: boolean;
};

export type EventListenOptions = {
  events?: string[];
  subscription_id?: string;
};

export type EventEnvelope = {
  id: string;
  type: string;
  created_at: string;
  event_app_id: string;
  delivery_profile: string;
  payload: unknown;
  metadata?: Record<string, unknown>;
};

export type EventListenConnected = {
  type: "connected";
  listener_id: string;
  events: string[];
};

export type EventListenMessage = EventListenConnected | EventEnvelope;

export type EventListenHandler = (message: EventListenMessage) => void;

export type EventListenHandle = {
  close: () => void;
};

export type EventsApi = {
  publish: (
    event: string,
    payload: unknown,
    options?: EventPublishOptions
  ) => Promise<EventPublishResponse>;
  subscribe: (input: EventSubscribeInput) => Promise<EventSubscribeResponse>;
  unsubscribe: (subscriptionId: string) => Promise<EventUnsubscribeResponse>;
  listen: (
    options: EventListenOptions,
    handler: EventListenHandler
  ) => EventListenHandle;
  listenUrl: (options?: EventListenOptions) => string;
};
