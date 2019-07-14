import {Injectable, Logger} from "@nestjs/common";
import {HttpAdapterHost} from "@nestjs/core";
import * as proxy from "http-proxy-middleware";

@Injectable()
export class Viewport {
  logger = new Logger(Viewport.name);
  constructor(refHost: HttpAdapterHost) {
    const composerProxy = proxy({
      target: "http://localhost:4500",
      pathRewrite: {
        "^/composer/viewport/sockjs-node": "/sockjs-node"
      },
      ws: true,
      changeOrigin: true,
      logLevel: "error",
      logProvider: () => {
        this.logger["info"] = this.logger.verbose.bind(this.logger);
        return this.logger;
      },
      onProxyRes: res => {
        res.headers["engine"] = "composer";
        res.headers["content-security-policy"] =
          "frame-ancestors http://localhost:4200 https://localhost:4200 localhost:4200 localhost:*";
      }
    });
    refHost.httpAdapter.use("/composer/viewport**", composerProxy);
  }
}
