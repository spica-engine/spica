import {readProxyRequestId, resolveHopTrace} from "@spica-server/core-http-tracker";

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

    expect(trace.requestId).toMatch(/^[0-9a-f-]{36}$/);
    expect(trace.parentHopId).toBeUndefined();
  });

  it("never takes the hop id from the caller, and creates a new one every time", () => {
    const first = resolveHopTrace({"x-spica-hop-id": "0123456789abcdef"});

    expect(first.hopId).not.toBe("0123456789abcdef");
    expect(first.hopId).not.toBe(resolveHopTrace({}).hopId);
  });
});

describe("readProxyRequestId", () => {
  it.each([
    ["an nginx or envoy id", "x-request-id", {"x-request-id": "dd73241871cb96e0c3b5cb4d3d4bb0f7"}],
    [
      "an alb trace id",
      "x-request-id",
      {"x-request-id": "Root=1-5759e988-bd862e3fe1be46a994272793"}
    ]
  ])("accepts %s", (_, header, headers) => {
    expect(readProxyRequestId(headers, header)).toBe(headers[header]);
  });

  it("reads the configured header whatever its case", () => {
    expect(readProxyRequestId({"x-amzn-trace-id": "Root=1-abc"}, "X-Amzn-Trace-Id")).toBe(
      "Root=1-abc"
    );
  });

  it.each([
    ["the header is missing", {}, "x-request-id"],
    ["no header is configured", {"x-request-id": "abc12345"}, undefined],
    ["the configured header is empty", {"x-request-id": "abc12345"}, ""],
    ["the value is empty", {"x-request-id": ""}, "x-request-id"],
    [
      "the value has spaces that could start another field",
      {"x-request-id": "abc spica_request_id=forged"},
      "x-request-id"
    ],
    ["the value has quotes", {"x-request-id": 'abc"def12345'}, "x-request-id"],
    ["the value has a line break", {"x-request-id": "abc\ndef12345"}, "x-request-id"],
    ["the value is too long", {"x-request-id": "a".repeat(129)}, "x-request-id"],
    [
      "the header was sent more than once",
      {"x-request-id": ["abc12345", "def12345"]},
      "x-request-id"
    ]
  ])("returns nothing when %s", (_, headers, header) => {
    expect(readProxyRequestId(headers as any, header)).toBeUndefined();
  });
});
