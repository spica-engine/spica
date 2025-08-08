import {Middlewares, getMatchedValue} from "../src/middlewares";
import {CorsOptions} from "../../interface/core";

describe("MiddleWare", () => {
  describe("Preflight", () => {
    let req = {
      header: (key: string, value?: string) => {
        if (value == undefined) {
          return req.headers[key];
        } else {
          req.headers[key] = value;
        }
      },
      headers: {},
      method: undefined
    };
    let res = {
      header: (key: string, value?: string) => {
        if (value == undefined) {
          return res.headers[key];
        } else {
          res.headers[key] = value;
        }
      },
      headers: {},
      end: jest.fn()
    };

    let next: jest.Mock = jest.fn();

    let options: CorsOptions = {
      allowCredentials: undefined,
      allowedHeaders: [],
      allowedMethods: [],
      allowedOrigins: []
    };

    beforeEach(() => {
      req.headers = {};
      res.headers = {};
    });

    afterEach(() => {
      next.mockReset();
      res.end.mockReset();
    });

    describe("Origin", () => {
      it("should put request origin to response header if it matches", () => {
        options.allowedOrigins = ["http://localhost:*"];
        req.header("Origin", "http://localhost:4200");
        Middlewares.Preflight(options)(req, res, next);
        expect(res.header("Access-Control-Allow-Origin")).toEqual("http://localhost:4200");
        expect(next).toHaveBeenCalledTimes(1);
      });

      it("should not put request origin to response header if it does not match", () => {
        options.allowedOrigins = ["http://www:*"];
        req.header("Origin", "http://localhost:4200");
        Middlewares.Preflight(options)(req, res, next);
        expect(res.header("Access-Control-Allow-Origin")).toEqual("");
        expect(next).toHaveBeenCalledTimes(1);
      });
    });

    describe("Method", () => {
      it("should put request header method to response header if it matches", () => {
        options.allowedMethods = ["GET"];
        req.header("access-control-request-method", "GET");
        Middlewares.Preflight(options)(req, res, next);
        expect(res.header("Access-Control-Allow-Methods")).toEqual("GET");
        expect(next).toHaveBeenCalledTimes(1);
      });

      it("should put request method to response header if it matches", () => {
        options.allowedMethods = ["GET"];
        req.method = "GET";
        Middlewares.Preflight(options)(req, res, next);
        expect(res.header("Access-Control-Allow-Methods")).toEqual("GET");
        expect(next).toHaveBeenCalledTimes(1);
      });

      it("should not put request method to response header if it does not match", () => {
        options.allowedMethods = ["GET"];
        req.header("access-control-request-method", "UPDATE");
        Middlewares.Preflight(options)(req, res, next);
        expect(res.header("Access-Control-Allow-Methods")).toEqual("");
        expect(next).toHaveBeenCalledTimes(1);
      });
    });

    describe("Headears", () => {
      it("should put request header to response header if it matches", () => {
        options.allowedHeaders = ["Authorization", "Content-Type", "Accept-Language"];
        req.header("access-control-request-headers", "authorization");
        Middlewares.Preflight(options)(req, res, next);
        expect(res.header("Access-Control-Allow-Headers")).toEqual("authorization");
        expect(next).toHaveBeenCalledTimes(1);
      });

      it("should work with multiple headers on request", () => {
        options.allowedHeaders = ["Authorization", "Content-Type", "Accept-Language"];
        req.header("access-control-request-headers", "authorization,content-type");
        Middlewares.Preflight(options)(req, res, next);
        expect(res.header("Access-Control-Allow-Headers")).toEqual("authorization,content-type");
        expect(next).toHaveBeenCalledTimes(1);
      });

      it("should put default headers to response header", () => {
        options.allowedHeaders = ["Authorization", "Content-Type", "Accept-Language"];
        Middlewares.Preflight(options)(req, res, next);
        expect(res.header("Access-Control-Allow-Headers")).toEqual(
          "Authorization,Content-Type,Accept-Language"
        );
        expect(next).toHaveBeenCalledTimes(1);
      });

      it("should not put header to response header if it does not match", () => {
        options.allowedHeaders = ["Authorization", "Content-Type", "Accept-Language"];
        req.header("access-control-request-headers", "X-Resource");
        Middlewares.Preflight(options)(req, res, next);
        expect(res.header("Access-Control-Allow-Headers")).toEqual("");
        expect(next).toHaveBeenCalledTimes(1);
      });
    });

    describe("Credentials", () => {
      it("should set response header 'Access-Control-Allow-Credentials' as true", () => {
        options.allowCredentials = true;
        Middlewares.Preflight(options)(req, res, next);
        expect(res.header("Access-Control-Allow-Credentials")).toEqual("true");
        expect(next).toHaveBeenCalledTimes(1);
      });

      it("should not put 'Access-Control-Allow-Credentials' to response header", () => {
        options.allowCredentials = false;
        Middlewares.Preflight(options)(req, res, next);
        expect(res.header("Access-Control-Allow-Credentials")).toEqual(undefined);
        expect(next).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe("getMatchedValue", () => {
    it("should return matched value when pattern matched", () => {
      expect(getMatchedValue("test123", ["test*"])).toEqual("test123");
    });

    it("should return undefined when pattern did not match", () => {
      expect(getMatchedValue("test", ["wrong"])).toEqual("");
    });

    it("should return matched value when one of patterns matched", () => {
      expect(getMatchedValue("test", ["test", "wrong"])).toEqual("test");
    });

    it("should return undefined when none of patterns matched", () => {
      expect(getMatchedValue("test", ["wrong", "another_wrong"])).toEqual("");
    });

    it("should return matched value when pattern is '*'", () => {
      expect(getMatchedValue("test", ["*"])).toEqual("test");
    });

    it("should return undefined when pattern is empty", () => {
      expect(getMatchedValue("test", [])).toEqual("");
    });

    it("should work with array", () => {
      expect(getMatchedValue(["test", "test1", "test2"], ["test"])).toEqual("test,test1,test2");
    });
  });
});
