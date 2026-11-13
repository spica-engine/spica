import {HOP_ID_HEADER, REQUEST_ID_HEADER, runWithTrace} from "@spica-server/core-trace";
import type {IncomingMessage} from "http";
import type {RequestHandler} from "express";
import morgan from "morgan";
import {HopTrace, getHopTrace, resolveHopTrace, setHopTrace} from "./hop-trace.js";

export interface HttpTrackerOptions {
  accessLogs: boolean;
  accessLogsUrlFilter?: string;
  accessLogsStatusCodeFilter?: string;
  accessLogsStream?: {write(line: string): unknown};
}

export interface HttpTracker {
  handler: RequestHandler;
  getTrace(req: IncomingMessage): HopTrace | undefined;
}

const ACCESS_LOG_FORMAT =
  ':prefix :remote-addr - :remote-user [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] ' +
  "request_id=:request-id hop_id=:hop-id parent_hop_id=:parent-hop-id started_at=:started-at duration_ms=:total-time[0]";

function registerAccessLogTokens() {
  const token = (read: (trace: HopTrace) => string | undefined) => (req: IncomingMessage) => {
    const trace = getHopTrace(req);
    return (trace && read(trace)) ?? "-";
  };

  morgan.token("prefix", () => "access-log:");
  morgan.token(
    "request-id",
    token(trace => trace.requestId)
  );
  morgan.token(
    "hop-id",
    token(trace => trace.hopId)
  );
  morgan.token(
    "parent-hop-id",
    token(trace => trace.parentHopId)
  );
  morgan.token(
    "started-at",
    token(trace => trace.startedAt.toISOString())
  );
}

function createAccessLog(options: HttpTrackerOptions): RequestHandler {
  registerAccessLogTokens();
  const urlFilter = new RegExp(options.accessLogsUrlFilter ?? ".*");
  const statusCodeFilter = new RegExp(options.accessLogsStatusCodeFilter ?? ".*");
  return morgan(ACCESS_LOG_FORMAT, {
    stream: options.accessLogsStream,
    skip: (req, res) => !urlFilter.test(req.url) || !statusCodeFilter.test(String(res.statusCode))
  });
}

export function createHttpTracker(options: HttpTrackerOptions): HttpTracker {
  const accessLog = options.accessLogs ? createAccessLog(options) : undefined;

  const handler: RequestHandler = (req, res, next) => {
    const tracked = getHopTrace(req);
    if (tracked) {
      return runWithTrace(tracked, next);
    }

    const trace = resolveHopTrace(req.headers);
    setHopTrace(req, trace);
    req.headers[REQUEST_ID_HEADER] = trace.requestId;
    req.headers[HOP_ID_HEADER] = trace.hopId;
    res.setHeader(REQUEST_ID_HEADER, trace.requestId);
    runWithTrace(trace, () => (accessLog ? accessLog(req, res, next) : next()));
  };

  return {handler, getTrace: getHopTrace};
}
