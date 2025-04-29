import {isMatch} from "matcher";
import {CorsOptions} from "@spica-server/interface/core";
import pkg from "body-parser";
const {json} = pkg;
import typeis from "type-is";

export namespace Middlewares {
  export function JsonBodyParser({
    limit,
    ignoreUrls
  }: {
    limit?: number;
    ignoreUrls: (string | RegExp)[];
  }): ReturnType<typeof json> {
    if (limit) {
      limit = limit * 1024 * 1024;
    }
    if (!ignoreUrls) {
      ignoreUrls = [];
    }
    const parser = json({
      limit: limit,
      type: req => {
        return (
          typeis(req, "application/json") &&
          ignoreUrls.every(ignore => !new RegExp(ignore).test(req.url))
        );
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

  export function Headers(options: object) {
    return (req, res, next) => {
      Object.entries(options).forEach(([key, value]) => {
        const headerSet = res.headers && res.headers[key];
        const isNullish = value == null || value == undefined;
        if (!headerSet && !isNullish) {
          res.set(key, value);
        }
      });
      next();
    };
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
  if (alloweds.findIndex(allowed => isMatch(source, allowed)) != -1) {
    return Array.isArray(source) ? source.join(",") : source;
  } else {
    return "";
  }
}
