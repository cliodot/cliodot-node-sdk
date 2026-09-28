import { createHash, randomUUID } from "crypto";

export const CLIODOT_INSTANCE_HEADER = "x-cliodot-instance-id";

const INSTANCE_ID_RE = /^[A-Za-z0-9._-]{8,128}$/;

function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function isNodeRuntime(): boolean {
  return typeof process !== "undefined" && Boolean(process.versions?.node);
}

function nodeMachineSeed(): string {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const os = require("os") as typeof import("os");
  let username = "";
  try {
    username = os.userInfo()?.username || "";
  } catch {
    username = "";
  }
  return [
    os.hostname?.() || "",
    os.platform?.() || "",
    os.arch?.() || "",
    username,
    os.homedir?.() || "",
    os.cpus?.()?.[0]?.model || "",
  ].join("|");
}

function readGlobal(name: string): any {
  return (globalThis as Record<string, any>)[name];
}

function browserInstanceSeed(appId: string): string {
  const key = `cliodot.events.instance.${appId}`;
  const storage = readGlobal("localStorage");
  try {
    if (storage && typeof storage.getItem === "function") {
      let stored = String(storage.getItem(key) || "");
      if (!stored) {
        stored =
          typeof randomUUID === "function"
            ? randomUUID()
            : sha256Hex(`${Date.now()}.${Math.random()}`);
        storage.setItem(key, stored);
      }
      return stored;
    }
  } catch {
    // private mode / disabled storage
  }
  const nav = readGlobal("navigator");
  const scr = readGlobal("screen");
  return [
    nav?.userAgent || "",
    nav?.language || "",
    String(scr?.width || ""),
    String(scr?.height || ""),
  ].join("|");
}

/**
 * Stable id for this Event app on this computer.
 * Same machine always hashes the same; a different computer gets a new id.
 */
export function resolveEventsInstanceId(input: {
  appId: string;
  instanceId?: string;
}): string {
  const override = input.instanceId?.trim();
  if (override) {
    if (INSTANCE_ID_RE.test(override)) return override;
    return sha256Hex(`cliodot-events:${input.appId}:override:${override}`);
  }

  const seed = isNodeRuntime()
    ? nodeMachineSeed()
    : browserInstanceSeed(input.appId);
  return sha256Hex(`cliodot-events|${input.appId}|${seed}`);
}

export function applyInstanceHeader(
  headers: Record<string, string>,
  instanceId: string
): Record<string, string> {
  if (instanceId) {
    headers[CLIODOT_INSTANCE_HEADER] = instanceId;
  }
  return headers;
}
