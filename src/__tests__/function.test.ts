import { flosync } from "../index";

describe("FunctionBuilder", () => {
  beforeEach(() => {
    flosync.configure({ connectors: {} });
  });

  it("creates and runs a function with transform and outputFrom", async () => {
    const validatePayment = flosync
      .function("validate-payment")
      .input({ amount: "number", currency: "string" })
      .step("validate", (s) =>
        s.validator({ amount: "{{ args.amount }}", currency: "{{ args.currency }}" })
      )
      .step("format", (s) =>
        s.transform({
          valid: "{{ stepResults.validate.valid }}",
          amount: "{{ args.amount }}",
        })
      )
      .outputFrom("format")
      .build();

    flosync.registerFunction(validatePayment);

    const result = await flosync.runFunction("validate-payment", {
      amount: 100,
      currency: "USD",
    });

    expect(result).toBeDefined();
    expect(result.valid).toBe(true);
    expect(result.amount).toBe(100);
  });

  it("uses function in workflow via call step", async () => {
    const validatePayment = flosync
      .function("validate-payment")
      .input({ amount: "number", currency: "string" })
      .step("format", (s) =>
        s.transform({
          valid: "true",
          amount: "{{ args.amount }}",
          currency: "{{ args.currency }}",
        })
      )
      .outputFrom("format")
      .build();

    flosync.registerFunction(validatePayment);

    const w = flosync
      .workflow("payment-flow")
      .http("POST", "/pay")
      .step("validate", (s) =>
        s.call("validate-payment", {
          amount: "{{ trigger.body.amount }}",
          currency: "{{ trigger.body.currency }}",
        })
      )
      .step("respond", (s) =>
        s.responder("json", { body: "{{ stepResults.validate }}" })
      )
      .build();

    flosync.register(w);

    const result = await flosync.run("payment-flow", {
      body: { amount: 50, currency: "NGN" },
    });

    expect(result.statusCode).toBe(200);
    expect(result.body.valid).toBeDefined();
    expect(result.body.valid).toBeTruthy();
    expect(Number(result.body.amount)).toBe(50);
  });
});
