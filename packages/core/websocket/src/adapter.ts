import {WsAdapter as BaseAdapter} from "@nestjs/platform-ws";
import {pathToRegexp} from "path-to-regexp";
import {WebSocketServer} from "ws";

export class WsAdapter extends BaseAdapter {
  paths = new Map<string, any>();

  create(port: number, options: any) {
    const server = new WebSocketServer({
      noServer: true
      // Documentation of the ws package says this should not be set because it increases memory usage significantly when enabled.
      // But enabling these lines reduces memory usage significantly on local development. It's clearly the opposite of what documentation says.
      // Should be tested on a remote server for more results. See the https://github.com/websockets/ws#websocket-compression

      // perMessageDeflate: {
      //   zlibDeflateOptions: {
      //     // See zlib defaults.
      //     chunkSize: 1024,
      //     memLevel: 7,
      //     level: 3
      //   },
      //   zlibInflateOptions: {
      //     chunkSize: 10 * 1024
      //   },
      //   // Other options settable:
      //   clientNoContextTakeover: true, // Defaults to negotiated value.
      //   serverNoContextTakeover: true, // Defaults to negotiated value.
      //   serverMaxWindowBits: 10, // Defaults to negotiated value.
      //   // Below options specified as default values.
      //   concurrencyLimit: 10, // Limits zlib concurrency for perf.
      //   threshold: 1024 // Size (in bytes) below which messages
      //   // should not be compressed if context takeover is disabled.
      // }
    });
    this.paths.set(options.path, server);
    server.shouldHandle = (req: any) => {
      const url = new URL(req.url, "http://insteadof");
      req.params = {};
      req.query = url.searchParams;
      req.route = {
        path: options.path
      };
      const {regexp: path, keys} = pathToRegexp(options.path);
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
        const {regexp} = pathToRegexp(path);
        if (regexp.test(url.pathname)) {
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
