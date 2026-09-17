import {
  cliodotFail,
  cliodotOk,
  cliodotValidationFail,
  ensureOkTrue,
  failureFromCaught,
  isCliodotFail,
  isCliodotOk,
  normalizeApiFailure,
  resolveConfigError,
  resolveRequiredString,
  SDK_ERROR,
} from "../cliodot-result";

describe("cliodot-result", () => {
  it("cliodotFail builds structured failure", () => {
    const result = cliodotFail("TEST", "boom", { status: 400 });
    expect(result).toEqual({
      ok: false,
      error: { code: "TEST", message: "boom", status: 400 },
    });
  });

  it("isCliodotOk / isCliodotFail discriminate", () => {
    expect(isCliodotOk(cliodotOk({ value: 1 }))).toBe(true);
    expect(isCliodotFail(cliodotValidationFail("bad"))).toBe(true);
  });

  it("resolveConfigError returns first invalid check", () => {
    expect(
      resolveConfigError([
        { valid: true, message: "ok" },
        { valid: false, message: "missing baseUrl" },
      ])
    ).toEqual({ code: SDK_ERROR.CONFIG, message: "missing baseUrl" });
  });

  it("resolveRequiredString validates non-empty strings", () => {
    expect(resolveRequiredString("", "service")).toEqual({
      ok: false,
      error: { code: SDK_ERROR.VALIDATION, message: "service is required" },
    });
    expect(resolveRequiredString("pay", "service")).toBeNull();
  });

  it("ensureOkTrue wraps bodies without ok", () => {
    expect(ensureOkTrue({ keys: [] })).toEqual({ ok: true, keys: [] });
    expect(ensureOkTrue({ ok: true, keys: [] })).toEqual({ ok: true, keys: [] });
  });

  it("normalizeApiFailure reads nested error objects", () => {
    expect(
      normalizeApiFailure({ ok: false, error: { code: "X", message: "nope" } }, 502)
    ).toEqual({
      ok: false,
      error: { code: "X", message: "nope", status: 502, details: { ok: false, error: { code: "X", message: "nope" } } },
    });
  });

  it("failureFromCaught maps axios-like errors", () => {
    const err = {
      response: {
        status: 401,
        data: { ok: false, error: { code: "UNAUTHORIZED", message: "bad key" } },
      },
      message: "Request failed with status code 401",
    };
    expect(failureFromCaught(err, "fallback")).toEqual({
      ok: false,
      error: {
        code: "UNAUTHORIZED",
        message: "bad key",
        status: 401,
        details: err.response.data,
      },
    });
  });
});
