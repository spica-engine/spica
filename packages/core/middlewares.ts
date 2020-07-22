import {json, raw} from "body-parser";
import * as BSON from "bson";

export interface CorsOptions {
  allowedOrigins?: string[];
  allowedMethods?: string[];
  allowedHeaders?: string[];
  overrideDefaultHeaders?: boolean;
  allowCredentials?: boolean;
}

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
    console.log(options)
    console.log(!!options.allowCredentials)
    return (req, res, next) => {
      //res.header("Access-Control-Allow-Origin", req.header("Origin") || "*");

      let allowedOrigin = mapAllowedOrigins(options.allowedOrigins, req);

      res.header("Access-Control-Allow-Origin", allowedOrigin);

      let allowedMethods = mapAllowedMethods(options.allowedMethods);

      res.header("Access-Control-Allow-Methods", allowedMethods);

      // if (req.header("access-control-request-method")) {
      //   res.header("Access-Control-Allow-Methods", req.header("access-control-request-method"));
      // }

      let allowedHeaders = mapAllowedHeaders(
        options.allowedHeaders,
        options.overrideDefaultHeaders,
        ["Authorization", "Content-Type", "Accept-Language"]
      );

      // let allowedHeaders = "Authorization, Content-Type, Accept-Language";
      // if (req.header("access-control-request-headers")) {
      //   allowedHeaders = req.header("access-control-request-headers");
      // }

      res.header("Access-Control-Allow-Headers", allowedHeaders);


      

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

  function mapAllowedOrigins(alloweds: string[], req: any): string {
    let result = "";
    if (alloweds && alloweds.length > 0) {
      if (alloweds.includes("*")) {
        result = "*";
      } else if (alloweds.includes(req.header("Origin"))) {
        result = req.header("Origin");
      } else {
        //which means denied
        result = "";
      }
    } else {
      result = "*";
    }
    
    return result;
  }

  function mapAllowedMethods(alloweds: string[]) {
    let result = "";
    if (alloweds && alloweds.length > 0) {
      if (alloweds.includes("*")) {
        result = "*";
      } else {
        result = alloweds.join(",");
      }
    } else {
      result = "*";
    }

    return result;
  }

  function mapAllowedHeaders(alloweds: string[], overrideDefaults: boolean, defaults: string[]) {
    let result = "";
    if (alloweds && alloweds.length > 0) {
      if (alloweds.includes("*")) {
        result = alloweds.includes("Authorization") ? ["*"].concat("Authorization").join(",") : "*";
      } else {
        result = overrideDefaults ? alloweds.join(",") : alloweds.concat(defaults).join(",");
      }
    } else {
      result = overrideDefaults ? "" : defaults.join(",");
    }

    return result;
  }
}
