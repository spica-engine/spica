import {Injectable} from "@nestjs/common";
import * as CL from "ws";

export type WebsocketOptions = CL.ClientOptions;

@Injectable()
export class Websocket {
  get socket() {
    return `/tmp/${process.env.BAZEL_TARGET.replace(/\/|:/g, "_")}.sock`;
  }

  get(path: string, options?: WebsocketOptions): Client {
    return new Client(`ws+unix://${this.socket}:${path}`, options);
  }
}

export class Client extends CL {
  get connect() {
    return new Promise(resolve => this.once("open", (...args) => setTimeout(resolve, 2, args)));
  }

  close() {
    super.close();
    return new Promise(resolve => this.once("close", (...args) => setTimeout(resolve, 2, args)));
  }

  send(data: any) {
    return new Promise((resolve, reject) =>
      super.send(data, err => {
        if (err) {
          return reject(err);
        }
        setTimeout(resolve, 1);
      })
    );
  }
}
