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
        },
        data: {
          events: ["order.created"],
          name: "checkout",
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
      "https://api.example.com/event/v1/listen?app_id=evt_app_test&access_token=eak_test_key&events=order.created%2Cpayment.completed"
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
});
