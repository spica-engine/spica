import {AsyncLocalStorage} from "async_hooks";
import {HOP_ID_HEADER, REQUEST_ID_HEADER, isValidTraceId} from "./headers.js";

export interface RequestTrace {
  requestId: string;
  hopId: string;
}

const currentTrace = new AsyncLocalStorage<RequestTrace | undefined>();

export function runWithTrace<T>(trace: RequestTrace | undefined, fn: () => T): T {
  return currentTrace.run(trace, fn);
}

export function getCurrentTrace(): RequestTrace | undefined {
  return currentTrace.getStore();
}

export function readRequestTrace(
  headers: {key: string; value: string}[]
): RequestTrace | undefined {
  const requestId = headers.find(header => header.key == REQUEST_ID_HEADER)?.value;
  const hopId = headers.find(header => header.key == HOP_ID_HEADER)?.value;
  return isValidTraceId(requestId) && isValidTraceId(hopId) ? {requestId, hopId} : undefined;
}

export function traceRequest<T>(headers: {key: string; value: string}[], fn: () => T): T {
  return runWithTrace(readRequestTrace(headers), fn);
}
