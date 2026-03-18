import { flosync } from "../index";

describe("ProcessorEngine", () => {
  beforeEach(() => {
    flosync.configure({ connectors: {} });
  });

  it("runs a simple workflow with validator and responder", async () => {
    const w = flosync
      .workflow("test-flow")
      .http("POST", "/test")
      .step("validate", (s) =>
        s.validator({ amount: "{{ trigger.body.amount }}", currency: "{{ trigger.body.currency }}" })
      )
      .step("respond", (s) =>
        s.responder("json", { statusCode: 200, body: "{{ stepResults.validate }}" })
      )
      .build();

    flosync.register(w);

    const result = await flosync.run("test-flow", {
      body: { amount: 100, currency: "USD" },
    });

    expect(result.statusCode).toBe(200);
    expect(result.body).toBeDefined();
    expect(result.body.valid).toBe(true);
  });

  it("runs workflow with condition then/else", async () => {
    const w = flosync
      .workflow("cond-flow")
      .http("POST", "/cond")
      .step("check", (s) =>
        s.condition("{{ trigger.body.amount > 0 }}").then("ok").else("fail")
      )
      .step("ok", (s) => s.responder("json", { statusCode: 200, body: { status: "ok" } }))
      .step("fail", (s) => s.responder("json", { statusCode: 400, body: { status: "fail" } }))
      .build();

    flosync.register(w);

    const okResult = await flosync.run("cond-flow", { body: { amount: 10 } });
    expect(okResult.statusCode).toBe(200);
    expect(okResult.body).toEqual({ status: "ok" });

    const failResult = await flosync.run("cond-flow", { body: { amount: 0 } });
    expect(failResult.statusCode).toBe(400);
    expect(failResult.body).toEqual({ status: "fail" });
  });

  it("runs workflow with transform step", async () => {
    const w = flosync
      .workflow("transform-flow")
      .http("POST", "/transform")
      .step("transform", (s) =>
        s.transform({
          doubled: "{{ trigger.body.value * 2 }}",
          upper: "{{ uppercase(trigger.body.name) }}",
        })
      )
      .step("respond", (s) =>
        s.responder("json", { body: "{{ stepResults.transform }}" })
      )
      .build();

    flosync.register(w);

    const result = await flosync.run("transform-flow", {
      body: { value: 5, name: "hello" },
    });

    expect(result.statusCode).toBe(200);
    expect(result.body).toBeDefined();
    expect(result.body.doubled).toBe(10);
    expect(result.body.upper).toBe("HELLO");
  });

  it("validator fails and triggers else branch", async () => {
    const w = flosync
      .workflow("validator-else")
      .http("POST", "/v")
      .step("validate", (s) =>
        s.validator({ amount: "{{ trigger.body.amount }}" })
          .then("save")
          .else("error")
      )
      .step("save", (s) => s.responder("json", { statusCode: 200, body: { saved: true } }))
      .step("error", (s) =>
        s.responder("json", { statusCode: 400, body: { error: "Validation failed" } })
      )
      .build();

    flosync.register(w);

    const result = await flosync.run("validator-else", { body: {} });
    expect(result.statusCode).toBe(400);
    expect(result.body.error).toBe("Validation failed");
  });

  it("accepts plain object as trigger body (no body key)", async () => {
    const w = flosync
      .workflow("plain-body")
      .http("POST", "/plain")
      .step("respond", (s) =>
        s.responder("json", { body: { received: "{{ trigger.body.amount }}" } })
      )
      .build();

    flosync.register(w);

    const result = await flosync.run("plain-body", { amount: 42 });
    expect(result.statusCode).toBe(200);
    expect(Number(result.body.received)).toBe(42);
  });

  it("passes headers, pathParams, params, query, vars to template context", async () => {
    const w = flosync
      .workflow("full-payload")
      .http("POST", "/users/:id")
      .step("respond", (s) =>
        s.responder("json", {
          body: {
            bodyAmount: "{{ trigger.body.amount }}",
            headerX: "{{ headers['x-request-id'] }}",
            pathId: "{{ pathParams.id }}",
            queryPage: "{{ query.page }}",
            varOverride: "{{ vars.override }}",
          },
        })
      )
      .build();

    flosync.register(w);

    const result = await flosync.run("full-payload", {
      body: { amount: 10 },
      headers: { "x-request-id": "req-123" },
      pathParams: { id: "user-456" },
      query: { page: 2 },
      vars: { override: "from-payload" },
    });

    expect(result.statusCode).toBe(200);
    expect(Number(result.body.bodyAmount)).toBe(10);
    expect(result.body.headerX).toBe("req-123");
    expect(result.body.pathId).toBe("user-456");
    expect(Number(result.body.queryPage)).toBe(2);
    expect(result.body.varOverride).toBe("from-payload");
  });

  it("supports {{ body.x }} and {{ trigger.x }} for body fields", async () => {
    const w = flosync
      .workflow("body-trigger-access")
      .http("POST", "/test")
      .step("respond", (s) =>
        s.responder("json", {
          body: {
            viaBody: "{{ body.account }}",
            viaTrigger: "{{ trigger.email }}",
          },
        })
      )
      .build();

    flosync.register(w);

    const result = await flosync.run("body-trigger-access", {
      body: { account: "acct-1", email: "user@example.com" },
    });

    expect(result.statusCode).toBe(200);
    expect(result.body.viaBody).toBe("acct-1");
    expect(result.body.viaTrigger).toBe("user@example.com");
  });

  it("runs workflow without http trigger (manual)", async () => {
    const w = flosync
      .workflow("manual-flow")
      .step("respond", (s) =>
        s.responder("json", { body: { received: "{{ body.amount }}" } })
      )
      .build();

    flosync.register(w);

    const result = await flosync.run("manual-flow", { body: { amount: 99 } });
    expect(result.statusCode).toBe(200);
    expect(Number(result.body.received)).toBe(99);
  });

  it("builds workflow with job trigger", async () => {
    const w = flosync
      .workflow("job-flow")
      .job("0 * * * *", "UTC")
      .step("respond", (s) => s.responder("json", { body: { ok: true } }))
      .build();

    expect(w.trigger.type).toBe("job");
    expect((w.trigger as any).cron).toBe("0 * * * *");
    expect((w.trigger as any).timezone).toBe("UTC");

    flosync.register(w);
    const result = await flosync.run("job-flow", {});
    expect(result.statusCode).toBe(200);
    expect(result.body.ok).toBe(true);
  });
});
