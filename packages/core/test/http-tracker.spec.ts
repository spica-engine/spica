import bodyParser from "body-parser";
import express from "express";
import http from "http";
import {AddressInfo} from "net";
import {getCurrentTrace} from "@spica-server/core-trace";
import {HttpTracker, createHttpTracker, getHopTrace} from "@spica-server/core-http-tracker";

const VALID_REQUEST_ID = "11111111-2222-3333-4444-555555555555";
const VALID_PARENT_HOP_ID = "abcdef0123456789";
const PROXY_ID = "dd73241871cb96e0c3b5cb4d3d4bb0f7";

describe("HttpTracker handler", () => {
  function handle(
    headers: Record<string, string> = {},
    options: Partial<Parameters<typeof createHttpTracker>[0]> = {}
  ) {
    const tracker = createHttpTracker({accessLogs: false, ...options});
    const req: any = {headers: {...headers}};
    const res: any = {setHeader: jest.fn()};
    let current: ReturnType<typeof getCurrentTrace>;
    const next = jest.fn(() => {
      current = getCurrentTrace();
    });

    tracker.handler(req, res, next);

    return {tracker, req, res, next, currentInNext: () => current};
  }

  it("generates the ids, writes them to the request headers and returns the request id", () => {
    const {req, res} = handle();
    const trace = getHopTrace(req);

    expect(req.headers["x-spica-request-id"]).toBe(trace.requestId);
    expect(req.headers["x-spica-hop-id"]).toBe(trace.hopId);
    expect(res.setHeader).toHaveBeenCalledWith("x-spica-request-id", trace.requestId);
  });

  it("keeps the request id and parent hop of the caller", () => {
    const {req, res} = handle({
      "x-spica-request-id": VALID_REQUEST_ID,
      "x-spica-parent-hop-id": VALID_PARENT_HOP_ID
    });

    expect(getHopTrace(req)).toMatchObject({
      requestId: VALID_REQUEST_ID,
      parentHopId: VALID_PARENT_HOP_ID
    });
    expect(res.setHeader).toHaveBeenCalledWith("x-spica-request-id", VALID_REQUEST_ID);
  });

  it("does not let the caller choose the hop id or an invalid request id", () => {
    const {req} = handle({"x-spica-request-id": "bad id", "x-spica-hop-id": "spoofedspoofed00"});
    const trace = getHopTrace(req);

    expect(req.headers["x-spica-hop-id"]).toBe(trace.hopId);
    expect(req.headers["x-spica-hop-id"]).not.toBe("spoofedspoofed00");
    expect(req.headers["x-spica-request-id"]).toBe(trace.requestId);
    expect(trace.requestId).not.toBe("bad id");
  });

  it("makes the trace the current one for what follows, and only for that", () => {
    const {req, currentInNext, next} = handle();

    expect(next).toHaveBeenCalledTimes(1);
    expect(currentInNext()).toBe(getHopTrace(req));
    expect(getCurrentTrace()).toBeUndefined();
  });

  it("keeps the proxy id next to the spica ids and never uses it as the request id", () => {
    const {req} = handle({"x-request-id": PROXY_ID});

    expect(getHopTrace(req).proxyRequestId).toBe(PROXY_ID);
    expect(getHopTrace(req).requestId).not.toBe(PROXY_ID);
  });

  it("reads the proxy id from the configured header", () => {
    const {req} = handle(
      {"x-request-id": PROXY_ID, "x-amzn-trace-id": "Root=1-abc"},
      {accessLogsProxyRequestIdHeader: "X-Amzn-Trace-Id"}
    );

    expect(getHopTrace(req).proxyRequestId).toBe("Root=1-abc");
  });

  it("only runs what follows in the same trace when it is mounted again", () => {
    const {tracker, req, res} = handle();
    const trace = getHopTrace(req);
    let current: ReturnType<typeof getCurrentTrace>;

    tracker.handler(req, res, () => (current = getCurrentTrace()));

    expect(current).toBe(trace);
    expect(getHopTrace(req)).toBe(trace);
    expect(res.setHeader).toHaveBeenCalledTimes(1);
  });
});

describe("HttpTracker access log", () => {
  let server: http.Server;
  let accessLog: string[];
  let seen: ReturnType<typeof getCurrentTrace>[];

  async function start(
    options: Partial<Parameters<typeof createHttpTracker>[0]>,
    mount: (app: express.Application, tracker: HttpTracker) => void
  ) {
    const tracker = createHttpTracker({
      accessLogs: true,
      accessLogsStream: {write: line => accessLog.push(String(line).trim())},
      ...options
    });
    const app = express();
    mount(app, tracker);
    server = http.createServer(app);
    await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
    return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  }

  const handlers = (app: express.Application) => {
    const record = (_: express.Request, res: express.Response) => {
      seen.push(getCurrentTrace());
      res.end("ok");
    };
    app.get("/things", record);
    app.post("/things", record);
  };

  beforeEach(() => {
    accessLog = [];
    seen = [];
  });

  afterEach(() => new Promise(resolve => server.close(resolve)));

  it("writes the spica ids, the proxy id and the timing of a request", async () => {
    const url = await start({}, (app, tracker) => {
      app.use(tracker.handler);
      handlers(app);
    });

    await fetch(`${url}/things`, {
      headers: {
        "x-spica-request-id": VALID_REQUEST_ID,
        "x-spica-parent-hop-id": VALID_PARENT_HOP_ID,
        "x-request-id": PROXY_ID
      }
    });

    expect(accessLog).toHaveLength(1);
    expect(accessLog[0]).toContain("access-log:");
    expect(accessLog[0]).toContain('"GET /things HTTP/1.1" 200');
    expect(accessLog[0]).toContain(`spica_request_id=${VALID_REQUEST_ID}`);
    expect(accessLog[0]).toContain(`spica_hop_id=${seen[0].hopId}`);
    expect(accessLog[0]).toContain(`spica_parent_hop_id=${VALID_PARENT_HOP_ID}`);
    expect(accessLog[0]).toContain(`proxy_request_id=${PROXY_ID} `);
    expect(accessLog[0]).toMatch(/started_at=\d{4}-\d{2}-\d{2}T[\d:.]+Z/);
    expect(accessLog[0]).toMatch(/duration_ms=\d+$/);
  });

  it("writes a dash for a proxy id that is missing or unsafe, never the value", async () => {
    const url = await start({}, (app, tracker) => {
      app.use(tracker.handler);
      handlers(app);
    });

    await fetch(`${url}/things`);
    await fetch(`${url}/things`, {headers: {"x-request-id": "abc spica_request_id=forged"}});

    expect(accessLog).toHaveLength(2);
    for (const line of accessLog) {
      expect(line).toContain("proxy_request_id=- ");
      expect(line).not.toContain("forged");
    }
  });

  it("writes the caller resolved by authentication, never the credential", async () => {
    const authenticate =
      (user: object): express.RequestHandler =>
      (req, _, next) => {
        (req as any).user = user;
        next();
      };
    const url = await start({}, (app, tracker) => {
      app.use(tracker.handler);
      app.get("/identity", authenticate({identifier: "admin"}), (_, res) => res.end("ok"));
      app.get("/apikey", authenticate({name: "my-key", key: "secret-key"}), (_, res) =>
        res.end("ok")
      );
      app.get("/anonymous", (_, res) => res.end("ok"));
    });

    await fetch(`${url}/identity`, {headers: {authorization: "IDENTITY header.payload.sig"}});
    await fetch(`${url}/apikey`, {headers: {authorization: "APIKEY secret-key"}});
    await fetch(`${url}/anonymous`);

    expect(accessLog[0]).toContain('auth="IDENTITY:admin"');
    expect(accessLog[1]).toContain('auth="APIKEY:my-key"');
    expect(accessLog[2]).toContain('auth="-"');
    expect(accessLog.join("\n")).not.toContain("secret-key");
    expect(accessLog.join("\n")).not.toContain("header.payload.sig");
  });

  it("writes the authorization header itself only when an auth guard ran and rejected it", async () => {
    const guardRan: express.RequestHandler = (req, _, next) => {
      (req as any).strategyType = "APIKEY";
      next();
    };
    const url = await start({}, (app, tracker) => {
      app.use(tracker.handler);
      app.get("/rejected", guardRan, (_, res) => res.status(401).end());
      app.get("/crafted", guardRan, (_, res) => res.status(401).end());
      app.get("/unguarded", (_, res) => res.end("ok"));
    });

    await fetch(`${url}/rejected`, {headers: {authorization: "APIKEY wrong-key"}});
    await fetch(`${url}/crafted`, {headers: {authorization: 'APIKEY x" spica_request_id=forged'}});
    await fetch(`${url}/unguarded`, {headers: {authorization: "IDENTITY valid.token.value"}});

    expect(accessLog[0]).toContain('auth="APIKEY wrong-key"');
    expect(accessLog[1]).toContain('auth="APIKEY x_ spica_request_id=forged"');
    expect(accessLog[1].match(/spica_request_id=/g)).toHaveLength(2);
    expect(accessLog[2]).toContain('auth="-"');
    expect(accessLog[2]).not.toContain("valid.token.value");
  });

  it("writes the full unresolved authorization header without truncation", async () => {
    const url = await start({}, (app, tracker) => {
      app.use(tracker.handler);
      app.get(
        "/long",
        (req, _, next) => {
          (req as any).strategyType = "IDENTITY";
          next();
        },
        (_, res) => res.status(401).end()
      );
    });
    const header = `IDENTITY ${"a".repeat(500)}`;

    await fetch(`${url}/long`, {headers: {authorization: header}});

    expect(accessLog[0]).toContain(`auth="${header}"`);
  });

  it("sanitizes a crafted identifier so it cannot add fields to the line", async () => {
    const url = await start({}, (app, tracker) => {
      app.use(tracker.handler);
      app.get("/things", (req, res) => {
        (req as any).user = {identifier: 'evil" spica_request_id=forged'};
        res.end("ok");
      });
    });

    await fetch(`${url}/things`);

    expect(accessLog[0]).toContain('auth="evil__spica_request_id_forged"');
    expect(accessLog[0]).not.toContain("spica_request_id=forged");
  });

  it("applies the url and status code filters", async () => {
    const url = await start(
      {accessLogsUrlFilter: "^/logged", accessLogsStatusCodeFilter: "^2"},
      (app, tracker) => {
        app.use(tracker.handler);
        app.get("/logged", (_, res) => res.end("ok"));
        app.get("/ignored", (_, res) => res.end("ok"));
      }
    );

    await fetch(`${url}/logged`);
    await fetch(`${url}/ignored`);
    await fetch(`${url}/logged-but-missing`);

    expect(accessLog).toHaveLength(1);
    expect(accessLog[0]).toContain('"GET /logged HTTP/1.1" 200');
  });

  it("writes nothing when access logs are off, but still tracks the request", async () => {
    const url = await start({accessLogs: false}, (app, tracker) => {
      app.use(tracker.handler);
      handlers(app);
    });

    const response = await fetch(`${url}/things`);

    expect(accessLog).toEqual([]);
    expect(response.headers.get("x-spica-request-id")).toBe(seen[0].requestId);
  });

  it("logs a request once, however many times the handler is mounted", async () => {
    const url = await start({}, (app, tracker) => {
      app.use(tracker.handler);
      app.use(tracker.handler);
      handlers(app);
    });

    await fetch(`${url}/things`);

    expect(accessLog).toHaveLength(1);
  });

  it("keeps the trace across a body parser", async () => {
    const url = await start({}, (app, tracker) => {
      app.use(tracker.handler);
      app.use(bodyParser.json());
      handlers(app);
    });

    await fetch(`${url}/things`, {
      method: "POST",
      headers: {"content-type": "application/json"},
      body: JSON.stringify({a: 1})
    });

    expect(seen[0]).toBeDefined();
    expect(accessLog[0]).toContain(`spica_hop_id=${seen[0].hopId}`);
  });
});
