import {json, raw} from "body-parser";
import * as BSON from "bson";

export namespace Middlewares {
  export function BsonBodyParser(req, res, next) {
    return raw({
      type: "application/bson",
      limit: "20mb"
    })(req, res, error => {
      if (req.headers["content-type"] == "application/bson") {
        req.body = BSON.deserialize(req.body);
      }
      next(error);
    });
  }

  export function MergePatchJsonParser(req, res, next) {
    const parser = json({type: "application/merge-patch+json"});
    return parser(req, res, next);
  }

  export function Preflight(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");

    if (req.header("access-control-request-method")) {
      res.header("Access-Control-Allow-Methods", req.header("access-control-request-method"));
    }

    let allowedHeaders = "Authorization, Content-Type, Accept-Language";
    if (req.header("access-control-request-headers")) {
      allowedHeaders = req.header("access-control-request-headers");
    }

    res.header("Access-Control-Allow-Headers", allowedHeaders);

    if (req.method == "OPTIONS") {
      res.end();
    } else {
      next();
    }
  }
}
