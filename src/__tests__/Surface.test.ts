import axios from "axios";
import crypto from "crypto";
import { Surface } from "../Surface";
import { CliodotApiError } from "../errors";

jest.mock("axios");
const mockedAxios = axios as jest.Mocked<typeof axios>;

function sha256Hex(value: string): string {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

describe("Surface", () => {
  const mockAxiosInstance = {
    get: jest.fn(),
    request: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockedAxios.create.mockReturnValue(mockAxiosInstance as any);
  });

  function createClient() {
    return new Surface({
      baseUrl: "https://api.example.com",
      slug: "acme",
      apiKey: "key_test",
      fetchSurface: false,
    }) as any;
  }

  it("requires baseUrl", () => {
    expect(() => new Surface({ baseUrl: "" } as any)).toThrow(CliodotApiError);
  });

  it("constructs a typed fluent client", () => {
    type Demo = { users: { list(): Promise<unknown> } };
    const api = new Surface<Demo>({
      baseUrl: "https://api.example.com",
      slug: "acme",
      apiKey: "key_test",
      fetchSurface: false,
    });
    expect(typeof api.users.list).toBe("function");
  });

  it("loads surface and invokes fluent op with attestation headers", async () => {
    mockAxiosInstance.get.mockResolvedValue({
      status: 200,
      data: {
        ok: true,
        surface: {
          version: 1,
          gateway: { slug: "acme", sdk_enabled: true },
          ops: [
            {
              id: "users.create",
              sdk_path: ["users"],
              op: "create",
              method: "POST",
              endpoint_path: "/users",
              path_params: [],
              query_schema: null,
              body: true,
            },
          ],
        },
      },
    });
    mockAxiosInstance.request.mockResolvedValue({
      status: 200,
      data: { ok: true, data: { id: "u1" } },
    });

    const api = createClient();
    const result = await api.users.create({ email: "a@b.com" });
    expect(result).toEqual({ id: "u1" });

    expect(mockAxiosInstance.get).toHaveBeenCalledWith(
      "https://api.example.com/acme/sdk/surface",
      expect.objectContaining({
        headers: expect.objectContaining({
          "X-Cliodot-Client": "sdk",
          "X-API-Key": "key_test",
          "X-Cliodot-SDK-Signature": expect.any(String),
        }),
      })
    );

    const invokeHeaders = mockAxiosInstance.request.mock.calls[0][0].headers;
    expect(invokeHeaders["X-Cliodot-Client"]).toBe("sdk");
    expect(invokeHeaders["X-Cliodot-SDK-Signature"]).toEqual(expect.any(String));
    const bodyHash = sha256Hex(JSON.stringify({ email: "a@b.com" }));
    expect(bodyHash).toHaveLength(64);
  });

  it("throws catchable CliodotApiError from invoke without background prefetch", async () => {
    mockAxiosInstance.get.mockResolvedValue({
      status: 401,
      data: { ok: false, error: "API key required" },
    });
    const api = createClient();
    await expect(api.users.create({ email: "a@b.com" })).rejects.toMatchObject({
      name: "CliodotApiError",
      message: "API key required",
      status: 401,
      code: "SURFACE_LOAD_FAILED",
    });
  });

  it("throws when op is not exposed", async () => {
    mockAxiosInstance.get.mockResolvedValue({
      status: 200,
      data: {
        ok: true,
        surface: {
          version: 1,
          gateway: { slug: "acme", sdk_enabled: true },
          ops: [],
        },
      },
    });
    const api = createClient();
    await expect(api.users.account()).rejects.toThrow("SDK operation not exposed: users.account");
  });

  it("maps path params for nested ops", async () => {
    mockAxiosInstance.get.mockResolvedValue({
      status: 200,
      data: {
        ok: true,
        surface: {
          version: 1,
          gateway: { slug: "acme", sdk_enabled: true },
          ops: [
            {
              id: "customers.cards.list",
              sdk_path: ["customers", "cards"],
              op: "list",
              method: "GET",
              endpoint_path: "/customers/{id}/cards",
              path_params: ["id"],
              query_schema: { type: "object", properties: { limit: { type: "number" } } },
              body: false,
            },
          ],
        },
      },
    });
    mockAxiosInstance.request.mockResolvedValue({
      status: 200,
      data: { ok: true, data: [] },
    });

    const api = createClient();
    await api.customers.cards.list("cust_1", { limit: 2 });
    expect(mockAxiosInstance.request).toHaveBeenCalledWith(
      expect.objectContaining({
        url: "https://api.example.com/acme/customers/cust_1/cards",
        method: "GET",
        params: { limit: 2 },
      })
    );
  });
});
