import {INestApplication} from "@nestjs/common";
import {Test} from "@nestjs/testing";
import {createHttpTracker} from "@spica-server/core-http-tracker";
import {CoreTestingModule, Request} from "@spica-server/core-testing";
import {HttpEnqueuer} from "@spica-server/function-enqueuer";
import {event} from "@spica-server/function-queue-proto";
import {HttpMethod} from "@spica-server/interface-function-enqueuer";

const VALID_REQUEST_ID = "11111111-2222-3333-4444-555555555555";

describe("http enqueuer request correlation", () => {
  let app: INestApplication;
  let request: Request;
  let httpQueue: {enqueue: jest.Mock; dequeue: jest.Mock};
  let accessLog: string[];

  function enqueuedHeaders() {
    const enqueued = httpQueue.enqueue.mock.calls[0][1];
    return enqueued.headers.map(header => [header.key, header.value]);
  }

  const enqueuedHeader = (name: string) =>
    Object.fromEntries(enqueuedHeaders())[name] as string | undefined;

  async function start(tracker: "none" | "router" | "router and app") {
    const module = await Test.createTestingModule({imports: [CoreTestingModule]}).compile();
    app = module.createNestApplication();
    request = module.get(Request);

    const instance = app.getHttpAdapter().getInstance();
    instance.use((_, __, next) => next());

    accessLog = [];
    const httpTracker = createHttpTracker({
      accessLogs: true,
      accessLogsStream: {write: line => accessLog.push(String(line).trim())}
    });

    httpQueue = {enqueue: jest.fn(), dequeue: jest.fn()};
    httpQueue.enqueue.mockImplementation((_, __, res) => res.end());

    const enqueuer = new HttpEnqueuer(
      {enqueue: jest.fn(), dequeue: jest.fn()} as any,
      httpQueue as any,
      instance,
      {allowCredentials: true, allowedHeaders: ["*"], allowedMethods: ["*"], allowedOrigins: ["*"]},
      {
        checkAuthentication: jest.fn().mockResolvedValue(true),
        checkAuthorization: jest.fn().mockResolvedValue(true)
      } as any,
      undefined,
      undefined,
      tracker == "none" ? undefined : httpTracker.handler
    );
    const target = new event.Target();
    target.cwd = "/tmp/fn1";
    target.handler = "default";
    enqueuer.subscribe(target, {method: HttpMethod.Get, path: "/trace", preflight: false});

    if (tracker == "router and app") {
      instance.use(httpTracker.handler);
    }

    await app.listen(request.socket);
  }

  afterEach(() => app.close());

  it("hands the function the ids the tracker generated", async () => {
    await start("router");

    await request.get("/fn-execute/trace");

    expect(enqueuedHeader("x-spica-request-id")).toMatch(/^[0-9a-f-]{36}$/);
    expect(enqueuedHeader("x-spica-hop-id")).toMatch(/^[0-9a-f]{16}$/);
  });

  it("hands the function exactly one copy of each id, never the hop id of the caller", async () => {
    await start("router");

    await request.get("/fn-execute/trace", undefined, {
      "x-spica-request-id": VALID_REQUEST_ID,
      "x-spica-hop-id": "spoofedspoofed00"
    });

    const keys = enqueuedHeaders().map(([key]) => key);
    expect(keys.filter(key => key == "x-spica-request-id")).toHaveLength(1);
    expect(keys.filter(key => key == "x-spica-hop-id")).toHaveLength(1);
    expect(enqueuedHeader("x-spica-request-id")).toBe(VALID_REQUEST_ID);
    expect(enqueuedHeader("x-spica-hop-id")).not.toBe("spoofedspoofed00");
  });

  it("logs a function request once even when the tracker is also mounted on the app", async () => {
    await start("router and app");

    await request.get("/fn-execute/trace", undefined, {"x-spica-request-id": VALID_REQUEST_ID});

    expect(accessLog).toHaveLength(1);
    expect(accessLog[0]).toContain(`spica_request_id=${VALID_REQUEST_ID}`);
    expect(accessLog[0]).toContain(`spica_hop_id=${enqueuedHeader("x-spica-hop-id")}`);
  });

  it("forwards the headers untouched when it is given no middleware", async () => {
    await start("none");

    const response = await request.get("/fn-execute/trace", undefined, {
      "x-spica-request-id": VALID_REQUEST_ID
    });

    expect(response.statusCode).toBe(200);
    expect(enqueuedHeader("x-spica-request-id")).toBe(VALID_REQUEST_ID);
    expect(enqueuedHeader("x-spica-hop-id")).toBeUndefined();
  });
});
