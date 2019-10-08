import {raw} from "body-parser";
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

  export function Preflight(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    if (req.header("access-control-request-method")) {
      res.header("Access-Control-Allow-Methods", req.header("access-control-request-method"));
    }
    res.header("Access-Control-Allow-Headers", "Authorization, Content-Type, Accept-Language");

    if (req.method == "OPTIONS") {
      res.end();
    } else {
      next();
    }
  }
}
