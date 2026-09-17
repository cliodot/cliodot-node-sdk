import axios from "axios";
import { ProviderServicesClient } from "../ProviderServicesClient";
import { isCliodotFail } from "../http/cliodot-result";

jest.mock("axios");
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe("ProviderServicesClient structured errors", () => {
  it("returns config error without throwing when baseUrl is missing", async () => {
    const client = new ProviderServicesClient({
      baseUrl: "",
      appId: "psv_app_test",
      apiKey: "pak_test",
    });
    const result = await client.catalog();
    expect(isCliodotFail(result)).toBe(true);
    if (isCliodotFail(result)) {
      expect(result.error.code).toBe("SDK_CONFIG_INVALID");
    }
  });

  it("returns validation error without throwing for missing service", async () => {
    const client = new ProviderServicesClient({
      baseUrl: "https://example.com",
      appId: "psv_app_test",
      apiKey: "pak_test",
    });
    const result = await client.execute({
      service: "",
      operation: "charge",
      input: {},
    });
    expect(isCliodotFail(result)).toBe(true);
    if (isCliodotFail(result)) {
      expect(result.error.code).toBe("SDK_VALIDATION");
    }
  });

  it("returns validation error for invalid fluent path", async () => {
    const client = new ProviderServicesClient({
      baseUrl: "https://example.com",
      appId: "psv_app_test",
      apiKey: "pak_test",
    });
    const result = await (client.api as any).payment();
    expect(isCliodotFail(result)).toBe(true);
  });
});

describe("ProviderServicesClient execute wire payload", () => {
  const mockAxiosInstance = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockedAxios.create.mockReturnValue(mockAxiosInstance as any);
  });

  function createClient() {
    return new ProviderServicesClient({
      baseUrl: "https://api.example.com",
      appId: "psv_app_test",
      apiKey: "pak_test",
    });
  }

  function mockExecuteSuccess() {
    mockAxiosInstance.mockResolvedValue({
      status: 200,
      data: {
        ok: true,
        service: "payments",
        operation: "charge",
        version: "v1",
        provider: "paystack",
        attempts: [{ provider: "paystack", ok: true }],
        result: { status: "success" },
      },
    });
  }

  it("forwards provider on execute()", async () => {
    mockExecuteSuccess();
    const client = createClient();
    const result = await client.execute({
      service: "payments",
      operation: "charge",
      input: { amount: 1000, currency: "NGN" },
      provider: "paystack",
    });
    expect(result.ok).toBe(true);
    expect(mockAxiosInstance).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "POST",
        url: "/v1/execute",
        data: {
          service: "payments",
          operation: "charge",
          input: { amount: 1000, currency: "NGN" },
          provider: "paystack",
        },
      })
    );
  });

  it("forwards provider from fluent api opts", async () => {
    mockExecuteSuccess();
    const client = createClient();
    const result = await (client.api as any).payments.charge(
      { amount: 1000, currency: "NGN" },
      { provider: "dojah", version: "v1" }
    );
    expect(result.ok).toBe(true);
    expect(mockAxiosInstance).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "POST",
        url: "/v1/execute",
        data: {
          service: "payments",
          operation: "charge",
          input: { amount: 1000, currency: "NGN" },
          version: "v1",
          provider: "dojah",
        },
      })
    );
  });

  it("forwards idempotency_key on execute()", async () => {
    mockExecuteSuccess();
    const client = createClient();
    const result = await client.execute({
      service: "payments",
      operation: "charge",
      input: { amount: 1000 },
      idempotency_key: "idem-abc-123",
    });
    expect(result.ok).toBe(true);
    expect(mockAxiosInstance).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          idempotency_key: "idem-abc-123",
        }),
      })
    );
  });
});
