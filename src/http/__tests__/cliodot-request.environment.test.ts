import {
  applyEnvironmentHeader,
  normalizeSdkEnvironment,
  resolveBearerAuthHeaders,
} from "../cliodot-request";

describe("SDK environment headers", () => {
  it("normalizes aliases and ignores invalid values", () => {
    expect(normalizeSdkEnvironment("development")).toBe("dev");
    expect(normalizeSdkEnvironment("production")).toBe("prod");
    expect(normalizeSdkEnvironment("staging")).toBeUndefined();
  });

  it("adds x-environment on bearer auth when pinned", () => {
    const headers = resolveBearerAuthHeaders({
      appId: "psv_app_1",
      apiKey: "pak_test",
      environment: "prod",
    });
    expect(headers).toMatchObject({
      "x-cliodot-app-id": "psv_app_1",
      Authorization: "Bearer pak_test",
      "x-environment": "prod",
    });
  });

  it("omits x-environment when the client is not pinned", () => {
    const headers = resolveBearerAuthHeaders({
      appId: "psv_app_1",
      apiKey: "pak_test",
    });
    expect(headers).toMatchObject({
      "x-cliodot-app-id": "psv_app_1",
      Authorization: "Bearer pak_test",
    });
    expect((headers as Record<string, string>)["x-environment"]).toBeUndefined();
  });

  it("does not add a header for unknown environment values", () => {
    const headers = applyEnvironmentHeader({}, "staging");
    expect(headers["x-environment"]).toBeUndefined();
  });
});
