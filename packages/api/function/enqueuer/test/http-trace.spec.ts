import {INestApplication} from "@nestjs/common";
import {Test} from "@nestjs/testing";
import {createHttpTracker} from "@spica-server/core-http-tracker";
import {CoreTestingModule, Request} from "@spica-server/core-testing";
import {HttpEnqueuer} from "@spica-server/function-enqueuer";
import {event} from "@spica-server/function-queue-proto";
import {HttpMethod} from "@spica-server/interface-function-enqueuer";

const VALID_REQUEST_ID = "11111111-2222-3333-4444-555555555555";
const VALID_PARENT_HOP_ID = "abcdef0123456789";

describe("http enqueuer request correlation", () => {
  let app: INestApplication;
  let request: Request;
  let httpQueue: {enqueue: jest.Mock; dequeue: jest.Mock};
  let accessLog: string[];

  function enqueuedHeaders() {
    const enqueued = httpQueue.enqueue.mock.calls[0][1];
    return Object.fromEntries(enqueued.headers.map(header => [header.key, header.value]));
  }

  async function start({mountTrackerOnApp}: {mountTrackerOnApp: boolean}) {
    const module = await Test.createTestingModule({imports: [CoreTestingModule]}).compile();
    app = module.createNestApplication();
    request = module.get(Request);

    const instance = app.getHttpAdapter().getInstance();
    instance.use((_, __, next) => next());

    accessLog = [];
    const tracker = createHttpTracker({
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
      tracker.handler
    );
    const target = new event.Target();
    target.cwd = "/tmp/fn1";
    target.handler = "default";
    enqueuer.subscribe(target, {method: HttpMethod.Get, path: "/trace", preflight: false});

    if (mountTrackerOnApp) {
      instance.use(tracker.handler);
    }
    instance.get("/plain", (_, res) => res.end("ok"));

    await app.listen(request.socket);
  }

  afterEach(() => app.close());

  describe.each([
    ["the function router only", false],
    ["the function router and the app", true]
  ])("when the tracker is mounted on %s", (_, mountTrackerOnApp) => {
    beforeEach(() => start({mountTrackerOnApp}));

    it("generates a request id, hands it to the function and returns it to the caller", async () => {
      const response = await request.get("/fn-execute/trace");

      const headers = enqueuedHeaders();
      expect(headers["x-spica-request-id"]).toMatch(/^[0-9a-f-]{36}$/);
      expect(headers["x-spica-hop-id"]).toMatch(/^[0-9a-f]{16}$/);
      expect(response.headers["x-spica-request-id"]).toBe(headers["x-spica-request-id"]);
    });

    it("keeps the request id the caller sent", async () => {
      const response = await request.get("/fn-execute/trace", undefined, {
        "x-spica-request-id": VALID_REQUEST_ID
      });

      expect(enqueuedHeaders()["x-spica-request-id"]).toBe(VALID_REQUEST_ID);
      expect(response.headers["x-spica-request-id"]).toBe(VALID_REQUEST_ID);
    });

    it("hands the function exactly one copy of each correlation header", async () => {
      await request.get("/fn-execute/trace", undefined, {
        "x-spica-request-id": VALID_REQUEST_ID,
        "x-spica-hop-id": "spoofedspoofed00"
      });

      const enqueued = httpQueue.enqueue.mock.calls[0][1];
      const keys = enqueued.headers.map(header => header.key);
      expect(keys.filter(key => key == "x-spica-request-id")).toHaveLength(1);
      expect(keys.filter(key => key == "x-spica-hop-id")).toHaveLength(1);
      expect(enqueuedHeaders()["x-spica-hop-id"]).not.toBe("spoofedspoofed00");
    });

    it("writes the correlation fields of a function request to the access log once", async () => {
      await request.get("/fn-execute/trace", undefined, {
        "x-spica-request-id": VALID_REQUEST_ID,
        "x-spica-parent-hop-id": VALID_PARENT_HOP_ID
      });

      const hopId = enqueuedHeaders()["x-spica-hop-id"];
      expect(accessLog).toHaveLength(1);
      expect(accessLog[0]).toContain(`spica_request_id=${VALID_REQUEST_ID}`);
      expect(accessLog[0]).toContain(`spica_hop_id=${hopId}`);
      expect(accessLog[0]).toContain(`spica_parent_hop_id=${VALID_PARENT_HOP_ID}`);
    });
  });

  it("forwards the headers untouched when it is given no middleware", async () => {
    const module = await Test.createTestingModule({imports: [CoreTestingModule]}).compile();
    app = module.createNestApplication();
    request = module.get(Request);
    const instance = app.getHttpAdapter().getInstance();
    instance.use((_, __, next) => next());
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
      } as any
    );
    const target = new event.Target();
    target.cwd = "/tmp/fn1";
    target.handler = "default";
    enqueuer.subscribe(target, {method: HttpMethod.Get, path: "/trace", preflight: false});
    await app.listen(request.socket);

    const response = await request.get("/fn-execute/trace", undefined, {
      "x-spica-request-id": VALID_REQUEST_ID
    });

    expect(response.statusCode).toBe(200);
    expect(enqueuedHeaders()["x-spica-request-id"]).toBe(VALID_REQUEST_ID);
    expect(enqueuedHeaders()["x-spica-hop-id"]).toBeUndefined();
  });
});
