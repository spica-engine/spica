import {WsAdapter as BaseAdapter} from "@nestjs/platform-ws";
import * as pathtoregexp from "path-to-regexp";

export class WsAdapter extends BaseAdapter {
  create(port: number, options: any) {
    const ws = super.create(port, options);
    ws.shouldHandle = req => {
      if (options.path) {
        const url = new URL(req.url, "http://insteadof");
        req.params = {};
        req.query = url.searchParams;
        req.route = {
          path: options.path
        };
        const keys: pathtoregexp.Key[] = [];
        const path = pathtoregexp(options.path, keys);
        const result = path.exec(url.pathname).slice(1);
        for (const [index, key] of keys.entries()) {
          req.params[key.name] = result[index];
        }
        return result && result.length;
      }
      return false;
    };

    return ws;
  }
}
