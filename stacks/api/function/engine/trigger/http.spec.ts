import {INestApplication} from "@nestjs/common";
import {Test} from "@nestjs/testing";
import {CoreTestingModule, Request} from "@spica-server/core/testing";
import {HttpMethod, HttpTrigger} from "./http";

describe("http trigger", () => {
  let app: INestApplication;
  let req: Request;
  let trigger: HttpTrigger;
  let noopTarget = {id: "_", handler: "_"};

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [CoreTestingModule],
      providers: [HttpTrigger]
    }).compile();

    app = module.createNestApplication();
    trigger = module.get(HttpTrigger);
    req = module.get(Request);
    await app.listen(req.socket);
  });

  it("should handle errors", async () => {
    const options = {method: HttpMethod.Get, path: "/test", preflight: false};
    const invoker = jasmine
      .createSpy("invoker")
      .and.callFake(() => Promise.reject({message: "some evil error"}));
    trigger.register(invoker, noopTarget, options);
    const response = await req.get("/fn-execute/test", {});
    expect(response.statusCode).toBe(500);
    expect(response.body).toEqual({message: "some evil error"});
    trigger.register(null, noopTarget, options);
  });

  it("should send the value returned from invoker as body", async () => {
    const options = {method: HttpMethod.Get, path: "/test", preflight: false};
    const invoker = jasmine
      .createSpy("invoker")
      .and.callFake(() => Promise.resolve({message: "here is the result"}));
    trigger.register(invoker, noopTarget, options);
    const response = await req.get("/fn-execute/test", {});
    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({message: "here is the result"});
    trigger.register(null, noopTarget, options);
  });

  it("should send the value returned from invoker as body if body has not been sent", async () => {
    const options = {method: HttpMethod.Get, path: "/test", preflight: false};
    const invoker = jasmine.createSpy("invoker").and.callFake(({parameters: [req, res]}) => {
      res.send({should: "send this instead."});
      return Promise.resolve({message: "here is the result"});
    });
    trigger.register(invoker, noopTarget, options);
    const response = await req.get("/fn-execute/test", {});
    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({should: "send this instead."});
    trigger.register(null, noopTarget, options);
  });

  it("should not handle preflight requests on indistinct paths", async () => {
    const response = await req.options("/fn-execute/test");
    expect(response.statusCode).toBe(404);
  });

  it("should handle preflight requests", async () => {
    const options = {method: HttpMethod.Post, path: "/test", preflight: true};
    const invoker = jasmine.createSpy("invoker");
    trigger.register(invoker, noopTarget, options);
    let response = await req.options("/fn-execute/test");
    expect(response.statusCode).toBe(200);
    expect(response.body).toBeUndefined();
    expect(response.headers["access-control-allow-origin"]).toBe("*");
    expect(invoker).not.toHaveBeenCalled();
    trigger.register(null, noopTarget, options);
  });

  it("should not handle preflight requests but route", async () => {
    const options = {method: HttpMethod.Post, path: "/test", preflight: false};
    const invoker = jasmine
      .createSpy(undefined, ({parameters: [req, res]}) => res.send({response: "back"}))
      .and.callThrough();
    trigger.register(invoker, noopTarget, options);

    const response = await req.options("/fn-execute/test");
    expect(response.statusCode).toBe(404);
    expect(invoker).not.toHaveBeenCalled();
    const postResponse = await req.post("/fn-execute/test");
    expect(postResponse.body).toEqual({response: "back"});
    expect(invoker).toHaveBeenCalledTimes(1);
    trigger.register(null, noopTarget, options);
  });

  it("should not handle preflight requests for get and head method", async () => {
    let options = {method: HttpMethod.Get, path: "/test1", preflight: true};
    trigger.register(jasmine.createSpy("invoker"), noopTarget, options);
    let response = await req.options("/fn-execute/test1");
    expect(response.statusCode).toBe(404);
    trigger.register(null, noopTarget, options);

    options = {method: HttpMethod.Head, path: "/test2", preflight: true};
    trigger.register(jasmine.createSpy("invoker"), noopTarget, options);
    response = await req.options("/fn-execute/test2");
    expect(response.statusCode).toBe(404);
    trigger.register(null, noopTarget, options);
  });

  it("should handle preflight and route conflicts gracefully", async () => {
    const putSpy = jasmine
      .createSpy(undefined, ({parameters: [req, res]}) => res.send({method: "Put"}))
      .and.callThrough();
    const putOptions = {
      method: HttpMethod.Put,
      path: "/sameroute",
      preflight: true
    };
    trigger.register(putSpy, noopTarget, putOptions);

    let response = await req.options("/fn-execute/sameroute");
    expect(response.statusCode).toBe(200);
    expect(putSpy).not.toHaveBeenCalled();

    response = await req.put("/fn-execute/sameroute");
    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({method: "Put"});
    expect(putSpy).toHaveBeenCalled();

    const postOptions = {
      method: HttpMethod.Post,
      path: "/sameroute",
      preflight: true
    };
    const postSpy = jasmine
      .createSpy(undefined, ({parameters: [req, res]}) => res.send({method: "Post"}))
      .and.callThrough();
    trigger.register(postSpy, noopTarget, postOptions);

    response = await req.options("/fn-execute/sameroute");
    expect(response.statusCode).toBe(200);
    expect(postSpy).not.toHaveBeenCalled();

    response = await req.post("/fn-execute/sameroute");
    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({method: "Post"});
    expect(postSpy).toHaveBeenCalled();

    // Test if we still have the preflight route
    trigger.register(null, noopTarget, postOptions);
    response = await req.options("/fn-execute/sameroute");
    expect(response.body).toBeUndefined();
    expect(response.headers["access-control-allow-origin"]).toBe("*");

    trigger.register(null, noopTarget, putOptions);
    response = await req.options("/fn-execute/sameroute");
    expect(response.statusCode).toBe(404);
  });

  it("should handle preflight conflicts with get, head and post method on same path", async () => {
    const headOptions = {method: HttpMethod.Head, path: "conflictedpath", preflight: true};
    trigger.register(jasmine.createSpy(), noopTarget, headOptions);

    const getOptions = {method: HttpMethod.Get, path: "/conflictedpath", preflight: true};
    trigger.register(jasmine.createSpy(), noopTarget, getOptions);

    trigger.register(jasmine.createSpy(), noopTarget, {
      method: HttpMethod.Post,
      path: "/conflictedpath/",
      preflight: true
    });

    let response = await req.options("/fn-execute/conflictedpath");
    expect(response.statusCode).toBe(200);
    expect(response.headers["access-control-allow-origin"]).toBe("*");

    trigger.register(null, noopTarget, headOptions);

    response = await req.options("/fn-execute/conflictedpath");
    expect(response.statusCode).toBe(200);
    expect(response.headers["access-control-allow-origin"]).toBe("*");

    trigger.register(null, noopTarget, getOptions);

    response = await req.options("/fn-execute/conflictedpath");
    expect(response.statusCode).toBe(200);
    expect(response.headers["access-control-allow-origin"]).toBe("*");
  });

  afterAll(() => {
    app.close();
  });
});
