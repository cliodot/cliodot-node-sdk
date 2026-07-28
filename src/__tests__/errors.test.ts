import { CliodotApiError, cliodotApiErrorFromAxios } from "../errors";

describe("CliodotApiError", () => {
  it("exposes only API body on response/data from axios errors", () => {
    const body = {
      ok: false,
      error: "Subscription not found",
      code: "EVENT_SUBSCRIBER_NOT_FOUND",
    };
    const err = cliodotApiErrorFromAxios(
      {
        message: "Request failed with status code 404",
        response: {
          status: 404,
          statusText: "Not Found",
          headers: { "content-type": "application/json" },
          config: { url: "/v1/subscribe/x", method: "delete" },
          request: {},
          data: body,
        },
      },
      "Request failed"
    );

    expect(err).toBeInstanceOf(CliodotApiError);
    expect(err.status).toBe(404);
    expect(err.message).toBe("Subscription not found");
    expect(err.code).toBe("EVENT_SUBSCRIBER_NOT_FOUND");
    expect(err.response).toEqual(body);
    expect(err.data).toEqual(body);
    expect(err.response).not.toHaveProperty("config");
    expect(err.response).not.toHaveProperty("headers");
    expect(err.response).not.toHaveProperty("request");
    expect(JSON.parse(JSON.stringify(err))).toEqual({
      name: "CliodotApiError",
      message: "Subscription not found",
      status: 404,
      code: "EVENT_SUBSCRIBER_NOT_FOUND",
      data: body,
      response: body,
    });
  });

  it("unwraps axios-like response option if passed to constructor", () => {
    const body = { ok: false, error: "Nope", code: "X" };
    const err = new CliodotApiError("Nope", {
      response: {
        status: 400,
        headers: {},
        config: {},
        data: body,
      },
    });
    expect(err.response).toEqual(body);
    expect(err.data).toEqual(body);
    expect(err.status).toBe(400);
  });
});
