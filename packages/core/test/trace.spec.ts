import http from "http";
import {AddressInfo} from "net";
import {
  getCurrentTrace,
  installTracePropagation,
  isValidTraceId,
  readRequestTrace,
  runWithTrace,
  traceRequest
} from "@spica-server/core-trace";

describe("isValidTraceId", () => {
  it("accepts uuids and hex ids", () => {
    expect(isValidTraceId("11111111-2222-3333-4444-555555555555")).toBe(true);
    expect(isValidTraceId("abcdef0123456789")).toBe(true);
  });

  it("rejects anything that could break a log line or is out of range", () => {
    expect(isValidTraceId(undefined)).toBe(false);
    expect(isValidTraceId("short")).toBe(false);
    expect(isValidTraceId("a".repeat(65))).toBe(false);
    expect(isValidTraceId("has space in it")).toBe(false);
    expect(isValidTraceId("line\nbreak0000000")).toBe(false);
  });
});

describe("readRequestTrace", () => {
  it("reads the request id and hop id from the handed over headers", () => {
    expect(
      readRequestTrace([
        {key: "accept", value: "*/*"},
        {key: "x-spica-request-id", value: "11111111-2222-3333-4444-555555555555"},
        {key: "x-spica-hop-id", value: "abcdef0123456789"}
      ])
    ).toEqual({requestId: "11111111-2222-3333-4444-555555555555", hopId: "abcdef0123456789"});
  });

  it("returns nothing when either id is missing or invalid", () => {
    expect(readRequestTrace([])).toBeUndefined();
    expect(
      readRequestTrace([{key: "x-spica-request-id", value: "11111111-2222-3333-4444-555555555555"}])
    ).toBeUndefined();
    expect(
      readRequestTrace([
        {key: "x-spica-request-id", value: "bad"},
        {key: "x-spica-hop-id", value: "abcdef0123456789"}
      ])
    ).toBeUndefined();
  });
});

describe("traceRequest", () => {
  const headers = [
    {key: "x-spica-request-id", value: "11111111-2222-3333-4444-555555555555"},
    {key: "x-spica-hop-id", value: "abcdef0123456789"}
  ];

  it("makes the trace of the handed over headers the current one", async () => {
    const seen = await traceRequest(headers, async () => {
      await new Promise(resolve => setTimeout(resolve, 1));
      return getCurrentTrace();
    });

    expect(seen).toEqual({
      requestId: "11111111-2222-3333-4444-555555555555",
      hopId: "abcdef0123456789"
    });
  });

  it("runs the function without a trace when the headers carry none", () => {
    expect(traceRequest([], getCurrentTrace)).toBeUndefined();
  });

  it("returns what the function returns", () => {
    expect(traceRequest(headers, () => 42)).toBe(42);
  });
});

describe("trace context", () => {
  const trace = {requestId: "request-a-0000000", hopId: "hop-a-000000000"};

  it("is available to everything running inside runWithTrace, across awaits", async () => {
    const seen = await runWithTrace(trace, async () => {
      await new Promise(resolve => setTimeout(resolve, 1));
      return getCurrentTrace();
    });

    expect(seen).toEqual(trace);
    expect(getCurrentTrace()).toBeUndefined();
  });

  it("is hidden again by running without a trace", () => {
    expect(runWithTrace(trace, () => runWithTrace(undefined, getCurrentTrace))).toBeUndefined();
  });
});

describe("trace propagation on outgoing calls", () => {
  let server: http.Server;
  let url: string;

  beforeAll(async () => {
    installTracePropagation();
    server = http.createServer((req, res) => {
      res.end(
        JSON.stringify({
          requestId: req.headers["x-spica-request-id"] ?? null,
          parentHopId: req.headers["x-spica-parent-hop-id"] ?? null
        })
      );
    });
    await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
    url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/`;
  });

  afterAll(() => new Promise(resolve => server.close(resolve)));

  const viaFetch = async () => JSON.parse(await (await fetch(url)).text());

  const viaHttp = () =>
    new Promise<any>((resolve, reject) =>
      http
        .get(url, res => {
          let body = "";
          res.on("data", chunk => (body += chunk));
          res.on("end", () => resolve(JSON.parse(body)));
        })
        .on("error", reject)
    );

  const trace = (n: string) => ({
    requestId: `request-${n}-0000000`,
    hopId: `hop-${n}-000000000`
  });

  it.each([
    ["fetch", viaFetch],
    ["http", viaHttp]
  ])("adds the request id and the parent hop to a call made with %s", async (_, call) => {
    const sent = await runWithTrace(trace("a"), call);

    expect(sent).toEqual({requestId: trace("a").requestId, parentHopId: trace("a").hopId});
  });

  it("adds nothing to calls made outside of a request", async () => {
    expect(await viaFetch()).toEqual({requestId: null, parentHopId: null});
    expect(await viaHttp()).toEqual({requestId: null, parentHopId: null});
  });

  it("adds nothing for work that carries no trace", async () => {
    expect(await runWithTrace(undefined, viaFetch)).toEqual({requestId: null, parentHopId: null});
  });

  it("keeps concurrent requests apart", async () => {
    const run = (n: string) =>
      runWithTrace(trace(n), async () => {
        await new Promise(resolve => setTimeout(resolve, Math.random() * 30));
        return [await viaFetch(), await viaHttp()];
      });

    const results = await Promise.all([run("a"), run("b"), run("c")]);

    results.forEach((sent, index) => {
      const expected = trace(["a", "b", "c"][index]);
      for (const call of sent) {
        expect(call).toEqual({requestId: expected.requestId, parentHopId: expected.hopId});
      }
    });
  });
});
