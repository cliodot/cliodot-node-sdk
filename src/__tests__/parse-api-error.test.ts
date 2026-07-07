import {
  parseApiErrorCode,
  parseApiErrorMessage,
  parseApiErrorStatus,
} from "../http/parse-api-error";

describe("parseApiError", () => {
  it("prefers top-level message over nested error object", () => {
    const data = {
      message: "No refresh token available for this connection",
      status: false,
      statusCode: 422,
      data: null,
      error: { statusCode: 422, code: "OAUTH_PROVIDER_ERROR" },
    };
    expect(parseApiErrorMessage(data)).toBe("No refresh token available for this connection");
    expect(parseApiErrorCode(data)).toBe("OAUTH_PROVIDER_ERROR");
    expect(parseApiErrorStatus(data)).toBe(422);
  });

  it("reads string error field", () => {
    const data = {
      ok: false,
      error: "Invalid or expired exchange code",
      code: "OAUTH_EXCHANGE_CODE_INVALID",
    };
    expect(parseApiErrorMessage(data)).toBe("Invalid or expired exchange code");
    expect(parseApiErrorCode(data)).toBe("OAUTH_EXCHANGE_CODE_INVALID");
  });
});
