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
    console.log(options);
    return (req, res, next) => {
      let allowedOrigin = getMatchedValue(req.header("Origin"), options.allowedOrigins);

      res.header("Access-Control-Allow-Origin", allowedOrigin);

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
          req.header("access-control-request-headers"),
          options.allowedHeaders
        );
      }

      res.header("Access-Control-Allow-Headers", allowedHeaders);

      if (options.allowCredentials) {
        console.log("TRUE");
      } else {
        console.log("FALSE");
      }

      if (options.allowCredentials) {
        req.header("Access-Control-Allow-Credentials", "true");
      } else {
        delete req.headers["Access-Control-Allow-Credentials"];
      }

      if (req.method == "OPTIONS") {
        res.end();
      } else {
        next();
      }
    };
  }

  function getMatchedValue(source: string, alloweds: string[]): string {
    if (alloweds.findIndex(allowed => matcher.isMatch(source, allowed)) != -1) {
      //console.log("MATCHED", source, alloweds);
      return source;
    } else {
      //console.log("NOT MATCHED", source, alloweds);
      return "";
    }
  }
}
