import type { HttpMethod } from "../types/builtin";
import { getOrCreateConnectorMeta } from "./metadata";

/**
 * Marks a class as a Connector Definition
 */
export function ConnectorClass(connectorId: string, connectorName?: string | any, config?: any) {
  return function (ctor: any) {
    const meta = getOrCreateConnectorMeta(ctor);
    meta.connectorId = connectorId;
    if (typeof connectorName === "object") {
        meta.connectorName = connectorId;
        meta.config = connectorName;
    } else {
        meta.connectorName = connectorName || connectorId;
        meta.config = config || {};
    }
  };
}

/**
 * Registers a remote HTTP execution action.
 */
export function ActionEndpoint(
  actionName: string,
  method: HttpMethod,
  path: string,
  config?: any
) {
  return function (target: any, propertyKey: string) {
    const ctor = target.constructor;
    const meta = getOrCreateConnectorMeta(ctor);
    meta.actions.push({
      actionName,
      methodKey: propertyKey,
      type: "endpoint",
      httpConfig: {
        method,
        path,
        ...config,
      },
    });
  };
}

/**
 * Registers a custom execution method locally on the class instance.
 */
export function ActionCustom(actionName: string) {
  return function (target: any, propertyKey: string) {
    const ctor = target.constructor;
    const meta = getOrCreateConnectorMeta(ctor);
    meta.actions.push({
      actionName,
      methodKey: propertyKey,
      type: "custom",
    });
  };
}
