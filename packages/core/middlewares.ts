import {json} from "body-parser";
import * as typeis from "type-is";

export namespace Middlewares {
  export function JsonBodyParser(limit?: number): ReturnType<typeof json> {
    if (limit) {
      limit = limit * 1024 * 1024;
    }
    const parser = json({
      limit: limit,
      type: req => {
        // TODO(thesayyn): Find a better way to handle this
        return typeis(req, "application/json") && !/$\/storage/.test(req.url);
      }
    });
    return parser;
  }

  export function MergePatchJsonParser(limit?: number): ReturnType<typeof json> {
    if (limit) {
      limit = limit * 1024 * 1024;
    }
    return (req, res, next) => json({type: "application/merge-patch+json", limit})(req, res, next);
  }

  export function Preflight(req, res, next) {
    res.header("Access-Control-Allow-Origin", req.header("Origin") || "*");

    if (req.header("access-control-request-method")) {
      res.header("Access-Control-Allow-Methods", req.header("access-control-request-method"));
    }

    let allowedHeaders = "Authorization, Content-Type, Accept-Language";
    if (req.header("access-control-request-headers")) {
      allowedHeaders = req.header("access-control-request-headers");
    }

    res.header("Access-Control-Allow-Headers", allowedHeaders);

    req.header("Access-Control-Allow-Credentials", "true");

    if (req.method == "OPTIONS") {
      res.end();
    } else {
      next();
    }
  }
}
