import bodyParser from "body-parser";
import express from "express";
import http from "http";
import {AddressInfo} from "net";
import {getCurrentTrace, installTracePropagation} from "@spica-server/core-trace";
import {
  HttpTracker,
  createHttpTracker,
  getHopTrace,
  resolveHopTrace
} from "@spica-server/core-http-tracker";

const VALID_REQUEST_ID = "11111111-2222-3333-4444-555555555555";
const VALID_PARENT_HOP_ID = "abcdef0123456789";

describe("resolveHopTrace", () => {
  it("generates a request id and a hop id when the caller sent none", () => {
    const trace = resolveHopTrace({});

    expect(trace.requestId).toMatch(/^[0-9a-f-]{36}$/);
    expect(trace.hopId).toMatch(/^[0-9a-f]{16}$/);
    expect(trace.parentHopId).toBeUndefined();
  });

  it("keeps a valid request id and parent hop id from the caller", () => {
    const trace = resolveHopTrace({
      "x-spica-request-id": VALID_REQUEST_ID,
      "x-spica-parent-hop-id": VALID_PARENT_HOP_ID
    });

    expect(trace.requestId).toBe(VALID_REQUEST_ID);
    expect(trace.parentHopId).toBe(VALID_PARENT_HOP_ID);
  });

  it("replaces ids that are malformed", () => {
    const trace = resolveHopTrace({
      "x-spica-request-id": "short",
      "x-spica-parent-hop-id": "bad value with spaces and \n newline"
    });

    expect(trace.requestId).not.toBe("short");
    expect(trace.requestId).toMatch(/^[0-9a-f-]{36}$/);
    expect(trace.parentHopId).toBeUndefined();
  });

  it("never takes the hop id from the caller", () => {
    const trace = resolveHopTrace({"x-spica-hop-id": "0123456789abcdef"});

    expect(trace.hopId).not.toBe("0123456789abcdef");
  });

  it("creates a different hop id for every call", () => {
    expect(resolveHopTrace({}).hopId).not.toBe(resolveHopTrace({}).hopId);
  });
});

describe("HttpTracker", () => {
  let server: http.Server;
  let accessLog: string[];
  let seenInHandler: any[];

  async function start(tracker: HttpTracker, mount: (app: express.Application) => void) {
    const app = express();
    mount(app);
    server = http.createServer(app);
    await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
    return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  }

  function createTracker(options: Partial<Parameters<typeof createHttpTracker>[0]> = {}) {
    return createHttpTracker({
      accessLogs: true,
      accessLogsStream: {write: line => accessLog.push(String(line).trim())},
      ...options
    });
  }

  beforeEach(() => {
    accessLog = [];
    seenInHandler = [];
  });

  afterEach(() => new Promise(resolve => server.close(resolve)));

  const record = (req: express.Request, res: express.Response) => {
    seenInHandler.push({
      stored: getHopTrace(req),
      current: getCurrentTrace(),
      headers: {...req.headers}
    });
    res.end("ok");
  };

  it("writes the correlation fields to the access log", async () => {
    const tracker = createTracker();
    const url = await start(tracker, app => {
      app.use(tracker.handler);
      app.get("/things", record);
    });

    await fetch(`${url}/things`, {
      headers: {
        "x-spica-request-id": VALID_REQUEST_ID,
        "x-spica-parent-hop-id": VALID_PARENT_HOP_ID
      }
    });

    expect(accessLog).toHaveLength(1);
    expect(accessLog[0]).toContain("access-log:");
    expect(accessLog[0]).toContain('"GET /things HTTP/1.1" 200');
    expect(accessLog[0]).toContain(`request_id=${VALID_REQUEST_ID}`);
    expect(accessLog[0]).toContain(`hop_id=${seenInHandler[0].stored.hopId}`);
    expect(accessLog[0]).toContain(`parent_hop_id=${VALID_PARENT_HOP_ID}`);
    expect(accessLog[0]).toMatch(/started_at=\d{4}-\d{2}-\d{2}T[\d:.]+Z/);
    expect(accessLog[0]).toMatch(/duration_ms=\d+$/);
  });

  it("returns the request id to the caller", async () => {
    const tracker = createTracker();
    const url = await start(tracker, app => {
      app.use(tracker.handler);
      app.get("/things", record);
    });

    const generated = await fetch(`${url}/things`);
    const kept = await fetch(`${url}/things`, {headers: {"x-spica-request-id": VALID_REQUEST_ID}});

    expect(generated.headers.get("x-spica-request-id")).toBe(seenInHandler[0].stored.requestId);
    expect(kept.headers.get("x-spica-request-id")).toBe(VALID_REQUEST_ID);
  });

  it("makes the incoming headers carry the ids of the trace", async () => {
    const tracker = createTracker();
    const url = await start(tracker, app => {
      app.use(tracker.handler);
      app.get("/things", record);
    });

    await fetch(`${url}/things`);
    await fetch(`${url}/things`, {headers: {"x-spica-request-id": VALID_REQUEST_ID}});

    const [generated, kept] = seenInHandler;
    expect(generated.headers["x-spica-request-id"]).toBe(generated.stored.requestId);
    expect(generated.headers["x-spica-hop-id"]).toBe(generated.stored.hopId);
    expect(kept.headers["x-spica-request-id"]).toBe(VALID_REQUEST_ID);
    expect(kept.headers["x-spica-hop-id"]).toBe(kept.stored.hopId);
  });

  it("does not let the caller choose the hop id", async () => {
    const tracker = createTracker();
    const url = await start(tracker, app => {
      app.use(tracker.handler);
      app.get("/things", record);
    });

    await fetch(`${url}/things`, {
      headers: {"x-spica-request-id": "malformed id", "x-spica-hop-id": "spoofedspoofed00"}
    });

    const {headers, stored} = seenInHandler[0];
    expect(headers["x-spica-hop-id"]).toBe(stored.hopId);
    expect(headers["x-spica-hop-id"]).not.toBe("spoofedspoofed00");
    expect(headers["x-spica-request-id"]).toBe(stored.requestId);
    expect(headers["x-spica-request-id"]).not.toBe("malformed id");
  });

  it("makes the trace the current one for the handlers that follow", async () => {
    const tracker = createTracker();
    const url = await start(tracker, app => {
      app.use(tracker.handler);
      app.get("/things", record);
    });

    await fetch(`${url}/things`);

    expect(seenInHandler[0].current).toEqual(seenInHandler[0].stored);
  });

  it("tracks requests without writing an access log when logging is off", async () => {
    const tracker = createTracker({accessLogs: false});
    const url = await start(tracker, app => {
      app.use(tracker.handler);
      app.get("/things", record);
    });

    const response = await fetch(`${url}/things`);

    expect(accessLog).toEqual([]);
    expect(response.headers.get("x-spica-request-id")).toBe(seenInHandler[0].stored.requestId);
    expect(seenInHandler[0].current).toEqual(seenInHandler[0].stored);
  });

  it("applies the url and status code filters", async () => {
    const tracker = createTracker({
      accessLogsUrlFilter: "^/logged",
      accessLogsStatusCodeFilter: "^2"
    });
    const url = await start(tracker, app => {
      app.use(tracker.handler);
      app.get("/logged", record);
      app.get("/ignored", record);
    });

    await fetch(`${url}/logged`);
    await fetch(`${url}/ignored`);
    await fetch(`${url}/logged-but-missing`);

    expect(accessLog).toHaveLength(1);
    expect(accessLog[0]).toContain('"GET /logged HTTP/1.1" 200');
  });

  it("logs a request once, however many times the handler is mounted", async () => {
    const tracker = createTracker();
    const url = await start(tracker, app => {
      app.use(tracker.handler);
      app.use(tracker.handler);
      app.get("/things", record);
    });

    await fetch(`${url}/things`);

    expect(accessLog).toHaveLength(1);
  });

  it("keeps the trace across a body parser", async () => {
    const tracker = createTracker();
    const url = await start(tracker, app => {
      app.use(tracker.handler);
      app.use(bodyParser.json());
      app.post("/things", record);
    });

    await fetch(`${url}/things`, {
      method: "POST",
      headers: {"content-type": "application/json"},
      body: JSON.stringify({a: 1})
    });

    expect(seenInHandler[0].current).toEqual(seenInHandler[0].stored);
  });

  it("adds the correlation headers to calls the handlers make", async () => {
    installTracePropagation();
    const downstream = http.createServer((req, res) =>
      res.end(JSON.stringify({requestId: req.headers["x-spica-request-id"] ?? null}))
    );
    await new Promise<void>(resolve => downstream.listen(0, "127.0.0.1", resolve));
    const downstreamUrl = `http://127.0.0.1:${(downstream.address() as AddressInfo).port}`;

    const tracker = createTracker();
    const url = await start(tracker, app => {
      app.use(tracker.handler);
      app.get("/things", async (_, res) => {
        res.end(await (await fetch(downstreamUrl)).text());
      });
    });

    const body = await (
      await fetch(`${url}/things`, {headers: {"x-spica-request-id": VALID_REQUEST_ID}})
    ).json();
    await new Promise(resolve => downstream.close(resolve));

    expect(body).toEqual({requestId: VALID_REQUEST_ID});
  });
});
