import axios from "axios";
import { CommercialAppClient } from "../CommercialAppClient";
import { CliodotApiError } from "../errors";

jest.mock("axios");
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe("CommercialAppClient", () => {
  const mockAxiosInstance = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockedAxios.create.mockReturnValue(mockAxiosInstance as any);
  });

  function createClient(
    overrides?: Partial<ConstructorParameters<typeof CommercialAppClient>[0]>
  ) {
    return new CommercialAppClient({
      baseUrl: "https://api.example.com",
      appId: "com_app_test",
      apiKey: "cak_test_key",
      ...overrides,
    });
  }

  it("requires baseUrl and appId", () => {
    expect(
      () => new CommercialAppClient({ baseUrl: "", appId: "com_app_test" })
    ).toThrow(CliodotApiError);
    expect(
      () =>
        new CommercialAppClient({
          baseUrl: "https://api.example.com",
          appId: "",
        })
    ).toThrow(CliodotApiError);
  });

  it("opens a renewal invoice on the current subscription", async () => {
    mockAxiosInstance.mockResolvedValue({
      data: {
        ok: true,
        created: true,
        invoice: {
          _id: "com_inv_ren_1",
          status: "open",
          currency: "USD",
          amount: 4900,
          total: 4900,
          metadata: { kind: "renewal", renew_on_success: true },
        },
        subscription: {
          _id: "com_sub_1",
          status: "pending_renewal",
        },
      },
    });
    const client = createClient();
    const result = await client.renewSubscription({
      subscriptionId: "com_sub_1",
      payment_method: "paystack",
    });
    expect(result.invoice._id).toBe("com_inv_ren_1");
    expect(result.created).toBe(true);
    expect(mockAxiosInstance).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "POST",
        url: "/v1/subscriptions/com_sub_1/renew",
        headers: {
          "x-cliodot-app-id": "com_app_test",
          Authorization: "Bearer cak_test_key",
        },
        data: { payment_method: "paystack" },
      })
    );
  });

  it("renew aliases renewSubscription", async () => {
    mockAxiosInstance.mockResolvedValue({
      data: {
        ok: true,
        created: false,
        invoice: { _id: "com_inv_ren_1", status: "open" },
        subscription: { _id: "com_sub_1" },
      },
    });
    const client = createClient();
    await client.renew({ subscriptionId: "com_sub_1" });
    expect(mockAxiosInstance).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "POST",
        url: "/v1/subscriptions/com_sub_1/renew",
      })
    );
  });

  it("requires subscriptionId for renew", () => {
    const client = createClient();
    expect(() => client.renewSubscription({ subscriptionId: "  " })).toThrow(
      "subscriptionId is required"
    );
  });

  it("confirms a provider renewal against the invoice", async () => {
    mockAxiosInstance.mockResolvedValue({
      data: {
        ok: true,
        reference: "com_inv_ren_1",
        invoice: { _id: "com_inv_ren_1", status: "paid", amount: 4900 },
        payment: {
          _id: "com_pay_1",
          status: "succeeded",
          provider_payment_id: "in_123",
        },
      },
    });
    const client = createClient();
    const result = await client.confirmPayment({
      reference: "com_inv_ren_1",
      status: "succeeded",
      provider_payment_id: "in_123",
    });
    expect(result.invoice.status).toBe("paid");
    expect(mockAxiosInstance).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "POST",
        url: "/v1/payments/confirm",
        data: {
          reference: "com_inv_ren_1",
          status: "succeeded",
          provider_payment_id: "in_123",
        },
      })
    );
  });

  it("lists and saves customer cards", async () => {
    mockAxiosInstance.mockResolvedValue({
      data: {
        ok: true,
        cards: [
          {
            _id: "com_card_1",
            last4: "4242",
            brand: "visa",
            is_default: true,
            status: "active",
          },
        ],
        pagination: { totalDocs: 1, page: 1, limit: 20 },
      },
    });
    const client = createClient();
    const listed = await client.listCards("acme-corp");
    expect(listed.cards[0].last4).toBe("4242");
    expect(mockAxiosInstance).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "GET",
        url: "/v1/customers/acme-corp/cards",
      })
    );

    mockAxiosInstance.mockResolvedValue({
      data: {
        ok: true,
        card: {
          _id: "com_card_2",
          last4: "1111",
          brand: "mastercard",
          is_default: false,
          status: "active",
        },
      },
    });
    const added = await client.addCard("acme-corp", {
      token: "AUTH_ok",
      last4: "1111",
      brand: "mastercard",
    });
    expect(added.card._id).toBe("com_card_2");
    expect(mockAxiosInstance).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "POST",
        url: "/v1/customers/acme-corp/cards",
        data: {
          token: "AUTH_ok",
          last4: "1111",
          brand: "mastercard",
        },
      })
    );
  });

  it("sets default and removes a card", async () => {
    mockAxiosInstance.mockResolvedValue({
      data: {
        ok: true,
        card: { _id: "com_card_1", is_default: true, status: "active" },
      },
    });
    const client = createClient();
    await client.setDefaultCard("acme-corp", "com_card_1");
    expect(mockAxiosInstance).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "POST",
        url: "/v1/customers/acme-corp/cards/com_card_1/default",
      })
    );

    mockAxiosInstance.mockResolvedValue({
      data: {
        ok: true,
        card: { _id: "com_card_1", status: "revoked" },
      },
    });
    await client.removeCard("acme-corp", "com_card_1");
    expect(mockAxiosInstance).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "DELETE",
        url: "/v1/customers/acme-corp/cards/com_card_1",
      })
    );
  });

  it("passes card_id on initiatePayment", async () => {
    mockAxiosInstance.mockResolvedValue({
      data: {
        ok: true,
        reference: "com_inv_1",
        invoice: { _id: "com_inv_1", status: "processing" },
        charge: {},
      },
    });
    const client = createClient();
    await client.initiatePayment({
      customer: "acme-corp",
      card_id: "com_card_1",
    });
    expect(mockAxiosInstance).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "POST",
        url: "/v1/payments/initiate",
        data: expect.objectContaining({
          customer: "acme-corp",
          card_id: "com_card_1",
        }),
      })
    );
  });
});
