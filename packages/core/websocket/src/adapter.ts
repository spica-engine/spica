import {WsAdapter as BaseAdapter} from "@nestjs/platform-ws";
import * as pathtoregexp from "path-to-regexp";
import * as ws from "ws";

export class WsAdapter extends BaseAdapter {
  paths = new Map<string, any>();

  create(port: number, options: any) {
    const server = new ws.Server({
      noServer: true
    });
    this.paths.set(options.path, server);
    server.shouldHandle = (req: any) => {
      const url = new URL(req.url, "http://insteadof");
      req.params = {};
      req.query = url.searchParams;
      req.route = {
        path: options.path
      };
      const keys: pathtoregexp.Key[] = [];
      const path = pathtoregexp(options.path, keys);
      const result = (path.exec(url.pathname) || []).slice(1);
      for (const [index, key] of keys.entries()) {
        req.params[key.name] = result[index];
      }
      return true;
    };

    this.httpServer.removeAllListeners("upgrade");
    this.httpServer.on("upgrade", (request, socket, head) => {
      let matched = false;
      for (const [path, server] of this.paths.entries()) {
        const url = new URL(request.url, "http://insteadof");
        if (pathtoregexp(path).test(url.pathname)) {
          matched = true;
          server.handleUpgrade(request, socket, head, (ws: any) => {
            ws.upgradeReq = request;
            server.emit("connection", ws, request);
          });
          break;
        }
      }
      if (!matched) {
        socket.destroy();
      }
    });
    return server;
  }
}
