import {INestApplication} from "@nestjs/common";
import {Test} from "@nestjs/testing";
import {CoreTestingModule, Request} from "@spica-server/core/testing";
import {HttpEnqueuer, HttpMethod} from "@spica-server/function/enqueuer";
import {EventQueue, HttpQueue} from "@spica-server/function/queue";
import {Event} from "@spica-server/function/queue/proto";

/**
 * TODO: Provide some tests for req.query, req.headers and req.params
 * TODO: Check if req.method, req.url, req.path is set
 */
describe("http enqueuer", () => {
  let app: INestApplication;
  let req: Request;
  let httpEnqueuer: HttpEnqueuer;
  let noopTarget: Event.Target;

  let eventQueue: jasmine.SpyObj<EventQueue>;
  let httpQueue: jasmine.SpyObj<HttpQueue>;

  let corsOptions = {
    allowCredentials: true,
    allowedHeaders: ["*"],
    allowedMethods: ["*"],
    allowedOrigins: ["*"]
  };

  beforeAll(async () => {
    noopTarget = new Event.Target();
    noopTarget.cwd = "/tmp/fn1";
    noopTarget.handler = "default";
    const module = await Test.createTestingModule({
      imports: [CoreTestingModule]
    }).compile();

    app = module.createNestApplication();
    req = module.get(Request);

    eventQueue = jasmine.createSpyObj("eventQueue", ["enqueue"]);
    httpQueue = jasmine.createSpyObj("httpQueue", ["enqueue", "dequeue"]);

    await app.listen(req.socket);
    httpEnqueuer = new HttpEnqueuer(
      eventQueue,
      httpQueue,
      app.getHttpAdapter().getInstance(),
      corsOptions
    );
  });

  afterEach(() => {
    // Reset enqueue spy in case some of the it blocks might have their spy delegates registered onto.
    httpQueue.enqueue = jasmine.createSpy();
  });

  it("should not handle preflight requests on indistinct paths", async () => {
    const response = await req.options("/fn-execute/test12312");
    expect(response.statusCode).toBe(404);
  });

  it("should handle preflight requests", async () => {
    const options = {method: HttpMethod.Post, path: "/test", preflight: true};
    httpEnqueuer.subscribe(noopTarget, options);
    let response = await req.options("/fn-execute/test", {Origin: "test"});
    expect(response.statusCode).toBe(200);
    expect(response.body).toBeUndefined();
    expect(response.headers["access-control-allow-origin"]).toBe("test");
    httpEnqueuer.unsubscribe(noopTarget);
  });

  it("should not handle preflight requests but route", async () => {
    const spy = httpQueue.enqueue.and.callFake((id, req, res) => {
      res.writeHead(200, undefined, {"Content-type": "application/json"});
      res.end(JSON.stringify({response: "back"}));
    });

    httpEnqueuer.subscribe(noopTarget, {
      method: HttpMethod.Post,
      path: "/test",
      preflight: false
    });

    const response = await req.options("/fn-execute/test");
    expect(response.statusCode).toBe(404);
    expect(spy).not.toHaveBeenCalled();
    const postResponse = await req.post("/fn-execute/test");
    expect(postResponse.body).toEqual({response: "back"});
    expect(spy).toHaveBeenCalledTimes(1);
    httpEnqueuer.unsubscribe(noopTarget);
  });

  it("should not handle preflight requests for head method", async () => {
    httpEnqueuer.subscribe(noopTarget, {
      method: HttpMethod.Head,
      path: "/test2",
      preflight: true
    });
    let response = await req.options("/fn-execute/test2");
    expect(response.statusCode).toBe(404);
    httpEnqueuer.unsubscribe(noopTarget);
  });

  it("should handle preflight requests on route", async () => {
    httpQueue.enqueue.and.callFake((_, __, res) => {
      res.writeHead(200, undefined, {"Content-type": "application/json"});
      res.end(JSON.stringify({}));
    });
    httpEnqueuer.subscribe(noopTarget, {
      method: HttpMethod.Post,
      path: "/test1",
      preflight: true
    });
    const response = await req.post("/fn-execute/test1", {}, {Origin: "test"});
    expect(response.headers["access-control-allow-origin"]).toBe("test");
    expect(response.body).toEqual({});
    httpEnqueuer.unsubscribe(noopTarget);
  });

  it("should handle preflight and route conflicts gracefully", async () => {
    const spy = httpQueue.enqueue.and.callFake((id, req, res) => {
      res.writeHead(200, undefined, {"Content-type": "application/json"});
      res.end(JSON.stringify({method: req.method}));
    });

    // PUT
    const putTarget = new Event.Target();
    putTarget.cwd = "/tmp/fn1";
    putTarget.handler = "put";

    httpEnqueuer.subscribe(putTarget, {
      method: HttpMethod.Put,
      path: "/sameroute",
      preflight: true
    });

    let response = await req.options("/fn-execute/sameroute");
    expect(response.statusCode).toBe(200);
    expect(spy).not.toHaveBeenCalled();

    response = await req.put("/fn-execute/sameroute");
    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({method: "PUT"});
    expect(spy).toHaveBeenCalledTimes(1);

    // Reset calls
    spy.calls.reset();

    // POST
    const postTarget = new Event.Target();
    postTarget.cwd = "/tmp/fn1";
    postTarget.handler = "post";
    httpEnqueuer.subscribe(postTarget, {
      method: HttpMethod.Post,
      path: "/sameroute",
      preflight: true
    });

    response = await req.options("/fn-execute/sameroute");
    expect(response.statusCode).toBe(200);
    expect(spy).not.toHaveBeenCalled();

    response = await req.post("/fn-execute/sameroute");
    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({method: "POST"});
    expect(spy).toHaveBeenCalledTimes(1);

    // Reset calls
    spy.calls.reset();

    // Remove post target and test if we still have the preflight route
    httpEnqueuer.unsubscribe(postTarget);

    response = await req.options("/fn-execute/sameroute", {Origin: "test"});
    expect(response.body).toBeUndefined();
    expect(response.headers["access-control-allow-origin"]).toBe("test");
    response = await req.options("/fn-execute/sameroute");
    expect(response.statusCode).toBe(200);
  });

  it("should handle preflight conflicts with get, head and post method on same path", async () => {
    // HEAD
    const headTarget = new Event.Target();
    headTarget.cwd = "/tmp/fn2";
    headTarget.handler = "fn1";
    httpEnqueuer.subscribe(headTarget, {
      method: HttpMethod.Head,
      path: "conflictedpath",
      preflight: true
    });

    // GET
    const getTarget = new Event.Target();
    getTarget.cwd = "/tmp/fn2";
    getTarget.handler = "default";
    httpEnqueuer.subscribe(getTarget, {
      method: HttpMethod.Get,
      path: "/conflictedpath",
      preflight: true
    });

    // POST
    const postTarget = new Event.Target();
    postTarget.cwd = "/tmp/fn2";
    postTarget.handler = "default";
    httpEnqueuer.subscribe(postTarget, {
      method: HttpMethod.Post,
      path: "/conflictedpath/",
      preflight: true
    });

    let response = await req.options("/fn-execute/conflictedpath", {Origin: "test"});
    expect(response.statusCode).toBe(200);
    expect(response.headers["access-control-allow-origin"]).toBe("test");

    // Remove Head method and see if we still have the preflight.
    httpEnqueuer.unsubscribe(headTarget);

    response = await req.options("/fn-execute/conflictedpath", {Origin: "test"});
    expect(response.statusCode).toBe(200);
    expect(response.headers["access-control-allow-origin"]).toBe("test");

    // Remove Get method and see if we still have the preflight.
    httpEnqueuer.unsubscribe(headTarget);

    response = await req.options("/fn-execute/conflictedpath", {Origin: "test"});
    expect(response.statusCode).toBe(200);
    expect(response.headers["access-control-allow-origin"]).toBe("test");
  });

  it("should forward body", async () => {
    // End the request immediately.
    httpQueue.enqueue.and.callFake((id, req, res) => res.end());

    httpEnqueuer.subscribe(noopTarget, {
      method: HttpMethod.Post,
      path: "/test",
      preflight: false
    });
    await req.post("/fn-execute/test", {test: 1}, {"Content-type": "application/json"});
    expect(httpQueue.enqueue).toHaveBeenCalledTimes(1);
    expect(Array.from(httpQueue.enqueue.calls.mostRecent().args[1].body)).toEqual([
      123,
      34,
      116,
      101,
      115,
      116,
      34,
      58,
      49,
      125
    ]);
  });

  it("should dequeue when connection is closed",  (done) => {
    httpQueue.enqueue.and.callFake((id, req, res) => {
      res.connection.destroy();
    });
    httpEnqueuer.subscribe(noopTarget, {
      method: HttpMethod.Get,
      path: "/test",
      preflight: false
    });
    expect(httpQueue.dequeue).not.toHaveBeenCalled();
    req.get("/fn-execute/test", {}).catch(() => {
      expect(httpQueue.dequeue).toHaveBeenCalled();
      httpEnqueuer.unsubscribe(noopTarget);
      done();
    });
  })

  afterAll(() => {
    app.close();
  });
});
