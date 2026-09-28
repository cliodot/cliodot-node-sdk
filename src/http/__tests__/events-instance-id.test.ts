import { createHash } from "crypto";
import { resolveEventsInstanceId } from "../events-instance-id";

jest.mock("os", () => ({
  hostname: jest.fn(() => "pc-one"),
  platform: jest.fn(() => "darwin"),
  arch: jest.fn(() => "arm64"),
  userInfo: jest.fn(() => ({ username: "huios" })),
  homedir: jest.fn(() => "/Users/huios"),
  cpus: jest.fn(() => [{ model: "Apple M-series" }]),
}));

const os = require("os") as {
  hostname: jest.Mock;
};

describe("resolveEventsInstanceId", () => {
  beforeEach(() => {
    os.hostname.mockReturnValue("pc-one");
  });

  it("keeps the same id on the same computer", () => {
    const a = resolveEventsInstanceId({ appId: "evt_app_1" });
    const b = resolveEventsInstanceId({ appId: "evt_app_1" });
    expect(a).toBe(b);
    expect(a).toHaveLength(64);
  });

  it("changes when the computer hostname changes", () => {
    const first = resolveEventsInstanceId({ appId: "evt_app_1" });
    os.hostname.mockReturnValue("pc-two");
    const second = resolveEventsInstanceId({ appId: "evt_app_1" });
    expect(second).not.toBe(first);
  });

  it("accepts a stable override", () => {
    expect(
      resolveEventsInstanceId({
        appId: "evt_app_1",
        instanceId: "test-instance",
      })
    ).toBe("test-instance");
  });

  it("hashes a short override", () => {
    const hashed = resolveEventsInstanceId({
      appId: "evt_app_1",
      instanceId: "pc1",
    });
    expect(hashed).toBe(
      createHash("sha256")
        .update("cliodot-events:evt_app_1:override:pc1")
        .digest("hex")
    );
  });
});
