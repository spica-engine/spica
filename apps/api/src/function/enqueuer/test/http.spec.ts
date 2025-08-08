import {INestApplication} from "@nestjs/common";
import {Test} from "@nestjs/testing";
import {CoreTestingModule, Request} from "../../../../../../libs/core/testing";
import {HttpEnqueuer} from "..";
import {EventQueue, HttpQueue} from "../../queue";
import {event} from "../../queue/proto";
import {HttpMethod} from "../../../../../../libs/interface/function/enqueuer";

/**
 * TODO: Provide some tests for req.query, req.headers and req.params
 * TODO: Check if req.method, req.url, req.path is set
 */

function createTarget(cwd?: string, handler?: string) {
  const target = new event.Target();
  target.cwd = cwd || "/tmp/fn1";
  target.handler = handler || "default";
  return target;
}

describe("http enqueuer", () => {
  let app: INestApplication;
  let req: Request;
  let httpEnqueuer: HttpEnqueuer;
  let noopTarget: event.Target;

  let eventQueue: {enqueue: jest.Mock; dequeue: jest.Mock};
  let httpQueue: {enqueue: jest.Mock; dequeue: jest.Mock};

  let schedulerUnsubscriptionSpy: jest.Mock;

  let corsOptions = {
    allowCredentials: true,
    allowedHeaders: ["*"],
    allowedMethods: ["*"],
    allowedOrigins: ["*"]
  };

  beforeEach(async () => {
    noopTarget = createTarget();
    const module = await Test.createTestingModule({
      imports: [CoreTestingModule]
    }).compile();

    app = module.createNestApplication();
    req = module.get(Request);

    eventQueue = {
      enqueue: jest.fn(),
      dequeue: jest.fn()
    };
    httpQueue = {
      enqueue: jest.fn(),
      dequeue: jest.fn()
    };

    await app.listen(req.socket);

    schedulerUnsubscriptionSpy = jest.fn();
    httpEnqueuer = new HttpEnqueuer(
      eventQueue as any,
      httpQueue as any,
      app.getHttpAdapter().getInstance(),
      corsOptions,
      schedulerUnsubscriptionSpy
    );
  });

  afterEach(() => {
    app.close();
  });

  it("should subscribe", () => {
    const options = {method: HttpMethod.Put, path: "/test", preflight: true};
    httpEnqueuer.subscribe(noopTarget, options);

    const routes = httpEnqueuer["router"].stack
      .filter(layer => layer.route && layer.route.path == "/test")
      .map(layer => layer.route);

    // one options and two put endpoints, one of put endpoints for allowing the preflight
    expect(routes.length).toEqual(3);

    const optionsRoute = routes[0].stack[0];
    const optionsCwdHandler = [optionsRoute.handle.target.cwd, optionsRoute.handle.target.handler];

    expect(optionsRoute.method).toEqual("options");
    expect(optionsCwdHandler).toEqual(["/tmp/fn1", "default"]);

    const putRoutes = [routes[1].stack[0], routes[2].stack[0]];

    expect(putRoutes.map(r => r.method)).toEqual(["put", "put"]);

    const cwds = [putRoutes[0].handle.target.cwd, putRoutes[1].handle.target.cwd];
    const handlers = [putRoutes[0].handle.target.handler, putRoutes[1].handle.target.handler];

    expect(cwds).toEqual(["/tmp/fn1", "/tmp/fn1"]);
    expect(handlers).toEqual(["default", "default"]);
  });

  it("should unsubscribe", () => {
    const options1 = {method: HttpMethod.Post, path: "/test1", preflight: true};
    const options2 = {method: HttpMethod.Put, path: "/test2", preflight: true};
    const options3 = {method: HttpMethod.Delete, path: "/test3", preflight: true};

    const target1 = createTarget("/tmp/fn1", "handler1");
    const target2 = createTarget("/tmp/fn1", "handler2");
    const target3 = createTarget("/tmp/fn2", "handler1");

    httpEnqueuer.subscribe(target1, options1);
    httpEnqueuer.subscribe(target2, options2);
    httpEnqueuer.subscribe(target3, options3);

    httpEnqueuer.unsubscribe(target1);

    const routes = httpEnqueuer["router"].stack
      .filter(layer => layer.route && layer.route.path.startsWith("/test"))
      .map(layer => layer.route);

    expect(routes.length).toEqual(6);

    expect(routes.map(r => r.stack[0].method).includes("post")).toEqual(false);
    expect(routes.map(r => r.stack[0].method).includes("put")).toEqual(true);
    expect(routes.map(r => r.stack[0].method).includes("delete")).toEqual(true);

    expect(schedulerUnsubscriptionSpy).toHaveBeenCalledWith(target1.id);
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
    const spy = httpQueue.enqueue.mockImplementation((id, req, res) => {
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
    httpQueue.enqueue.mockImplementation((_, __, res) => {
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
    const spy = httpQueue.enqueue.mockImplementation((id, req, res) => {
      res.writeHead(200, undefined, {"Content-type": "application/json"});
      res.end(JSON.stringify({method: req.method}));
    });

    // PUT
    const putTarget = new event.Target();
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
    spy.mockClear();

    // POST
    const postTarget = new event.Target();
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
    spy.mockClear();

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
    const headTarget = new event.Target();
    headTarget.cwd = "/tmp/fn2";
    headTarget.handler = "fn1";
    httpEnqueuer.subscribe(headTarget, {
      method: HttpMethod.Head,
      path: "conflictedpath",
      preflight: true
    });

    // GET
    const getTarget = new event.Target();
    getTarget.cwd = "/tmp/fn2";
    getTarget.handler = "default";
    httpEnqueuer.subscribe(getTarget, {
      method: HttpMethod.Get,
      path: "/conflictedpath",
      preflight: true
    });

    // POST
    const postTarget = new event.Target();
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
    httpQueue.enqueue.mockImplementation((id, req, res) => res.end());

    httpEnqueuer.subscribe(noopTarget, {
      method: HttpMethod.Post,
      path: "/test",
      preflight: false
    });
    await req.post("/fn-execute/test", {test: 1}, {"Content-type": "application/json"});
    expect(httpQueue.enqueue).toHaveBeenCalledTimes(1);
    expect(
      Array.from(httpQueue.enqueue.mock.calls[httpQueue.enqueue.mock.calls.length - 1][1].body)
    ).toEqual([123, 34, 116, 101, 115, 116, 34, 58, 49, 125]);
  });

  it("should dequeue when connection is closed", done => {
    httpQueue.enqueue.mockImplementation((id, req, res) => {
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
  });
});
