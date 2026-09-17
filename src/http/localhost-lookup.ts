import dns from "dns";
import http from "http";
import https from "https";
import type { LookupAddress, LookupOptions } from "dns";

type LookupCallback = (
  err: NodeJS.ErrnoException | null,
  address: string | LookupAddress[],
  family?: number
) => void;

export function isLoopbackHostname(hostname: string): boolean {
  const host = String(hostname || "")
    .trim()
    .toLowerCase()
    .replace(/\.$/, "");
  return host === "localhost" || host.endsWith(".localhost");
}

export function localhostAwareLookup(
  hostname: string,
  options: LookupOptions | number | LookupCallback,
  callback?: LookupCallback
): void {
  if (typeof options === "function") {
    callback = options;
    options = {};
  }
  const cb = callback;
  if (!cb) return;
  const opts: LookupOptions =
    typeof options === "number" ? { family: options } : options || {};

  if (isLoopbackHostname(hostname)) {
    if (opts.family === 6) {
      if (opts.all) {
        cb(null, [{ address: "::1", family: 6 }]);
        return;
      }
      cb(null, "::1", 6);
      return;
    }
    if (opts.all) {
      cb(null, [{ address: "127.0.0.1", family: 4 }]);
      return;
    }
    cb(null, "127.0.0.1", 4);
    return;
  }

  dns.lookup(hostname, opts, cb as any);
}

function isNodeRuntime(): boolean {
  return typeof process !== "undefined" && Boolean(process.versions?.node);
}

let httpAgent: http.Agent | undefined;
let httpsAgent: https.Agent | undefined;

export function cliodotHttpAgents(): {
  httpAgent?: http.Agent;
  httpsAgent?: https.Agent;
} {
  if (!isNodeRuntime()) return {};
  if (!httpAgent) {
    httpAgent = new http.Agent({
      keepAlive: true,
      lookup: localhostAwareLookup,
    });
  }
  if (!httpsAgent) {
    httpsAgent = new https.Agent({
      keepAlive: true,
      lookup: localhostAwareLookup,
    });
  }
  return { httpAgent, httpsAgent };
}
