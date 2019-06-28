import {Injectable, Logger} from "@nestjs/common";
import {HttpAdapterHost} from "@nestjs/core";
import * as proxy from "http-proxy-middleware";
import {Project} from "./project";

@Injectable()
export class Viewport {
  logger = new Logger(Viewport.name);
  constructor(refHost: HttpAdapterHost, project: Project) {
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
      }
    });
    refHost.httpAdapter.use("/composer/viewport**", composerProxy);
  }
}
