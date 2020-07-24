import {json, raw} from "body-parser";
import * as BSON from "bson";
import * as matcher from "matcher";
import {CorsOptions} from "./interfaces";

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

  export function Preflight(options: CorsOptions) {
    return (req, res, next) => {
      let allowedOrigin = getMatchedValue(req.header("Origin"), options.allowedOrigins);

      res.header("Access-Control-Allow-Origin", allowedOrigin);

      //console.log(res.header("Access-Control-Allow-Origin"));

      let allowedMethod = getMatchedValue(
        req.header("access-control-request-method")
          ? req.header("access-control-request-method")
          : req.method,
        options.allowedMethods
      );

      res.header("Access-Control-Allow-Methods", allowedMethod);

      let allowedHeaders = options.allowedHeaders.join(",");

      if (req.header("access-control-request-headers")) {
        allowedHeaders = getMatchedValue(
          req.header("access-control-request-headers").indexOf(",") != -1
            ? req.header("access-control-request-headers").split(",")
            : req.header("access-control-request-headers"),
          options.allowedHeaders
        );
      }

      res.header("Access-Control-Allow-Headers", allowedHeaders);

      if (options.allowCredentials) {
        res.header("Access-Control-Allow-Credentials", "true");
      }

      if (req.method == "OPTIONS") {
        res.end();
      } else {
        next();
      }
    };
  }
}

export function getMatchedValue(source: string | string[], alloweds: string[]): string {
  if (alloweds.findIndex(allowed => matcher.isMatch(source, allowed)) != -1) {
    return Array.isArray(source) ? source.join(",") : source;
  } else {
    return "";
  }
}
