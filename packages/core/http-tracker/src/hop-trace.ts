import {randomBytes, randomUUID} from "crypto";
import {IncomingHttpHeaders, IncomingMessage} from "http";
import {
  PARENT_HOP_ID_HEADER,
  REQUEST_ID_HEADER,
  RequestTrace,
  isValidTraceId
} from "@spica-server/core-trace";

export interface HopTrace extends RequestTrace {
  parentHopId?: string;
  startedAt: Date;
}

const hopTraces = new WeakMap<IncomingMessage, HopTrace>();

export function resolveHopTrace(headers: IncomingHttpHeaders, startedAt = new Date()): HopTrace {
  const requestId = headers[REQUEST_ID_HEADER];
  const parentHopId = headers[PARENT_HOP_ID_HEADER];
  return {
    requestId: isValidTraceId(requestId) ? requestId : randomUUID(),
    hopId: randomBytes(8).toString("hex"),
    parentHopId: isValidTraceId(parentHopId) ? parentHopId : undefined,
    startedAt
  };
}

export function setHopTrace(req: IncomingMessage, trace: HopTrace) {
  hopTraces.set(req, trace);
}

export function getHopTrace(req: IncomingMessage): HopTrace | undefined {
  return hopTraces.get(req);
}
