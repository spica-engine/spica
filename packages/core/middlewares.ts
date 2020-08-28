import * as matcher from "matcher";
import {CorsOptions} from "./interfaces";
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

  export function Preflight(options: CorsOptions) {
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
          req.header("access-control-request-headers").split(","),
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
