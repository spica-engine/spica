import {INestApplication} from "@nestjs/common";
import {Test} from "@nestjs/testing";
import {CoreTestingModule, Request} from "@spica-server/core/testing";
import {HttpEnqueuer, HttpMethod} from "@spica-server/function/enqueuer";
import {EventQueue, HttpQueue} from "@spica-server/function/queue";
import {Event} from "@spica-server/function/queue/proto";

describe("http trigger", () => {
  let app: INestApplication;
  let req: Request;
  let httpEnqueuer: HttpEnqueuer;
  let noopTarget: Event.Target;

  let eventQueue: jasmine.SpyObj<EventQueue>;
  let httpQueue: jasmine.SpyObj<HttpQueue>;

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
    httpQueue = jasmine.createSpyObj("httpQueue", ["enqueue"]);

    httpEnqueuer = new HttpEnqueuer(eventQueue, httpQueue, app as any);
    await app.listen(req.socket);
  });

  afterEach(() => {
    // Reset enqueue spy in case some of the it blocks might have their spy delegates registered onto.
    httpQueue.enqueue = jasmine.createSpy();
  });

  //   it("should handle errors", async () => {
  //     const options = {method: HttpMethod.Get, path: "/test", preflight: false};
  //     const invoker = jasmine
  //       .createSpy("invoker")
  //       .and.callFake(() => Promise.reject({message: "some evil error"}));
  //     httpEnqueuer.subscribe(noopTarget, options);
  //     const response = await req.get("/fn-execute/test", {});
  //     expect(response.statusCode).toBe(500);
  //     expect(response.body).toEqual({message: "some evil error"});
  //     httpEnqueuer.register(null, noopTarget, options);
  //   });

  //   it("should send the value returned from invoker as body", async () => {
  //     const options = {method: HttpMethod.Get, path: "/test", preflight: false};
  //     const invoker = jasmine
  //       .createSpy("invoker")
  //       .and.callFake(() => Promise.resolve({message: "here is the result"}));
  //     httpEnqueuer.subscribe(noopTarget, options);
  //     const response = await req.get("/fn-execute/test", {});
  //     expect(response.statusCode).toBe(200);
  //     expect(response.body).toEqual({message: "here is the result"});
  //     httpEnqueuer.register(null, noopTarget, options);
  //   });

  //   it("should send the value returned from invoker as body if body has not been sent", async () => {
  //     const options = {method: HttpMethod.Get, path: "/test", preflight: false};
  //     const invoker = jasmine.createSpy("invoker").and.callFake(({parameters: [req, res]}) => {
  //       res.send({should: "send this instead."});
  //       return Promise.resolve({message: "here is the result"});
  //     });
  //     httpEnqueuer.register(invoker, noopTarget, options);
  //     const response = await req.get("/fn-execute/test", {});
  //     expect(response.statusCode).toBe(200);
  //     expect(response.body).toEqual({should: "send this instead."});
  //     httpEnqueuer.register(null, noopTarget, options);
  //   });

  it("should not handle preflight requests on indistinct paths", async () => {
    const response = await req.options("/fn-execute/test12312");
    expect(response.statusCode).toBe(404);
  });

  it("should handle preflight requests", async () => {
    const options = {method: HttpMethod.Post, path: "/test", preflight: true};
    const invoker = jasmine.createSpy("invoker");
    httpEnqueuer.subscribe(noopTarget, options);
    let response = await req.options("/fn-execute/test");
    expect(response.statusCode).toBe(200);
    expect(response.body).toBeUndefined();
    expect(response.headers["access-control-allow-origin"]).toBe("*");
    expect(invoker).not.toHaveBeenCalled();
    httpEnqueuer.unsubscribe(noopTarget);
  });

  it("should not handle preflight requests but route", async () => {
    const options = {method: HttpMethod.Post, path: "/test", preflight: false};
    const spy = httpQueue.enqueue.and.callFake((id, req, res) => {
      res.writeHead(200, undefined, {"Content-type": "application/json"});
      res.end(JSON.stringify({response: "back"}));
    });
    httpEnqueuer.subscribe(noopTarget, options);

    const response = await req.options("/fn-execute/test");
    expect(response.statusCode).toBe(404);
    expect(spy).not.toHaveBeenCalled();
    const postResponse = await req.post("/fn-execute/test");
    expect(postResponse.body).toEqual({response: "back"});
    expect(spy).toHaveBeenCalledTimes(1);
    httpEnqueuer.unsubscribe(noopTarget);
  });

  it("should not handle preflight requests for get and head method", async () => {
    let options = {method: HttpMethod.Get, path: "/test1", preflight: true};
    httpEnqueuer.subscribe(noopTarget, options);
    let response = await req.options("/fn-execute/test1");
    expect(response.statusCode).toBe(404);
    httpEnqueuer.unsubscribe(noopTarget);

    options = {method: HttpMethod.Head, path: "/test2", preflight: true};
    httpEnqueuer.subscribe(noopTarget, options);
    response = await req.options("/fn-execute/test2");
    expect(response.statusCode).toBe(404);
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

    response = await req.options("/fn-execute/sameroute");
    expect(response.body).toBeUndefined();
    expect(response.headers["access-control-allow-origin"]).toBe("*");
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

    let response = await req.options("/fn-execute/conflictedpath");
    expect(response.statusCode).toBe(200);
    expect(response.headers["access-control-allow-origin"]).toBe("*");

    // Remove Head method and see if we still have the preflight.
    httpEnqueuer.unsubscribe(headTarget);

    response = await req.options("/fn-execute/conflictedpath");
    expect(response.statusCode).toBe(200);
    expect(response.headers["access-control-allow-origin"]).toBe("*");

    // Remove Get method and see if we still have the preflight.
    httpEnqueuer.unsubscribe(headTarget);

    response = await req.options("/fn-execute/conflictedpath");
    expect(response.statusCode).toBe(200);
    expect(response.headers["access-control-allow-origin"]).toBe("*");
  });

  afterAll(() => {
    app.close();
  });
});
