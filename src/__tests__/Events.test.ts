import axios from "axios";
import { Events } from "../Events";
import { CliodotApiError } from "../errors";

jest.mock("axios");
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe("Events", () => {
  const mockAxiosInstance = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockedAxios.create.mockReturnValue(mockAxiosInstance as any);
  });

  function createClient(
    overrides?: Partial<ConstructorParameters<typeof Events>[0]>
  ) {
    return new Events({
      baseUrl: "https://api.example.com",
      appId: "evt_app_test",
      apiKey: "eak_test_key",
      instanceId: "test-instance",
      ...overrides,
    });
  }

  it("requires baseUrl and appId", () => {
    expect(
      () => new Events({ baseUrl: "", appId: "evt_app_test" })
    ).toThrow(CliodotApiError);
    expect(
      () => new Events({ baseUrl: "https://api.example.com", appId: "" })
    ).toThrow(CliodotApiError);
  });

  it("publishes with bearer api key and app id header", async () => {
    mockAxiosInstance.mockResolvedValue({
      data: { ok: true, event_id: "evt_1", accepted: true },
    });
    const client = createClient();
    const result = await client.publish("order.created", { id: "ord_1" }, {
      ordering_key: "ord_1",
    });
    expect(result.event_id).toBe("evt_1");
    expect(mockAxiosInstance).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "POST",
        url: "/v1/publish",
        headers: {
          Authorization: "Bearer eak_test_key",
          "x-cliodot-app-id": "evt_app_test",
          "x-cliodot-instance-id": "test-instance",
        },
        data: {
          event: "order.created",
          payload: { id: "ord_1" },
          ordering_key: "ord_1",
        },
      })
    );
  });

  it("uses app secret headers when api key is absent", async () => {
    mockAxiosInstance.mockResolvedValue({
      data: { ok: true, subscription_id: "evt_sub_1", events: ["order.created"] },
    });
    const client = createClient({
      apiKey: undefined,
      appSecret: "secret_1",
    });
    await client.subscribe({ events: ["order.created"], name: "checkout" });
    expect(mockAxiosInstance).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "POST",
        url: "/v1/subscribe",
        headers: {
          "x-cliodot-app-id": "evt_app_test",
          "x-cliodot-app-secret": "secret_1",
          "x-cliodot-instance-id": "test-instance",
        },
        data: {
          events: ["order.created"],
          name: "checkout",
          instance_id: "test-instance",
        },
      })
    );
  });

  it("unsubscribes by id", async () => {
    mockAxiosInstance.mockResolvedValue({
      data: { ok: true, deleted: true },
    });
    const client = createClient();
    const result = await client.unsubscribe("evt_sub_1");
    expect(result.deleted).toBe(true);
    expect(mockAxiosInstance).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "DELETE",
        url: "/v1/subscribe/evt_sub_1",
      })
    );
  });

  it("builds browser listenUrl with query auth", () => {
    const client = createClient();
    const url = client.listenUrl({ events: ["order.created", "payment.completed"] });
    expect(url).toBe(
      "https://api.example.com/event/v1/listen?app_id=evt_app_test&access_token=eak_test_key&instance_id=test-instance&events=order.created%2Cpayment.completed"
    );
  });

  it("accepts appApiKey alias", async () => {
    mockAxiosInstance.mockResolvedValue({
      data: { ok: true, event_id: "evt_2", accepted: true },
    });
    const client = createClient({
      apiKey: undefined,
      appApiKey: "eak_alias",
    });
    await client.publish("ping", {});
    expect(mockAxiosInstance).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer eak_alias",
        }),
      })
    );
  });

  it("auto-reconnects listen after stream ends until close", async () => {
    jest.useFakeTimers();
    const { EventEmitter } = require("events");
    const stream1 = new EventEmitter();
    const stream2 = new EventEmitter();
    (stream1 as any).destroy = jest.fn();
    (stream2 as any).destroy = jest.fn();

    mockAxiosInstance
      .mockResolvedValueOnce({ data: stream1 })
      .mockResolvedValueOnce({ data: stream2 });

    const client = createClient({ debug: false });
    const messages: any[] = [];
    const handle = client.listen({ events: ["order.created"] }, (m) => {
      messages.push(m);
    });

    await Promise.resolve();
    await Promise.resolve();
    stream1.emit(
      "data",
      Buffer.from(
        'data: {"type":"connected","listener_id":"sse_1","events":["order.created"]}\n\n'
      )
    );
    stream1.emit("end");

    await Promise.resolve();
    expect(messages).toHaveLength(1);

    await jest.advanceTimersByTimeAsync(1000);
    await Promise.resolve();
    await Promise.resolve();

    stream2.emit(
      "data",
      Buffer.from(
        'data: {"type":"connected","listener_id":"sse_2","events":["order.created"]}\n\n'
      )
    );
    expect(messages).toHaveLength(2);
    expect(mockAxiosInstance).toHaveBeenCalledTimes(2);

    handle.close();
    jest.useRealTimers();
  });

  it("does not reconnect when reconnect is false", async () => {
    jest.useFakeTimers();
    const { EventEmitter } = require("events");
    const stream1 = new EventEmitter();
    (stream1 as any).destroy = jest.fn();
    mockAxiosInstance.mockResolvedValueOnce({ data: stream1 });

    const client = createClient();
    client.listen({ events: ["order.created"], reconnect: false }, () => {});
    await Promise.resolve();
    await Promise.resolve();
    stream1.emit("end");
    await Promise.resolve();
    await jest.advanceTimersByTimeAsync(5000);
    expect(mockAxiosInstance).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });


  it("passes environment on publish", async () => {
    mockAxiosInstance.mockResolvedValue({
      data: { ok: true, event_id: "evt_env", accepted: true },
    });
    const client = createClient();
    await client.publish("order.created", { id: "1" }, { environment: "dev" });
    expect(mockAxiosInstance).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          event: "order.created",
          environment: "dev",
        }),
      })
    );
  });

  it("keeps instance id stable for this client and distinct across computers", async () => {
    mockAxiosInstance.mockResolvedValue({
      data: {
        ok: true,
        subscription_id: "evt_sub_1",
        events: ["order.created"],
        instance_id: "test-instance",
      },
    });
    const sameBox = createClient();
    await sameBox.subscribe({ events: ["order.created"] });
    await sameBox.subscribe({ events: ["order.created"] });
    const otherBox = createClient({ instanceId: "other-computer" });
    await otherBox.subscribe({ events: ["order.created"] });

    const calls = mockAxiosInstance.mock.calls.filter(
      (c) => c[0]?.url === "/v1/subscribe"
    );
    expect(calls).toHaveLength(3);
    expect(calls[0][0].data.instance_id).toBe("test-instance");
    expect(calls[1][0].data.instance_id).toBe("test-instance");
    expect(calls[2][0].data.instance_id).toBe("other-computer");
    expect(sameBox.instanceId).toBe("test-instance");
    expect(otherBox.instanceId).not.toBe(sameBox.instanceId);
  });
});
