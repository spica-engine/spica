import {Injectable} from "@nestjs/common";
import * as Client from "ws";

@Injectable()
export class Websocket {
  get socket() {
    return `/tmp/${process.env.BAZEL_TARGET.replace(/\/|:/g, "_")}.sock`;
  }

  get(path: string) {
    return new Client(`ws+unix://${this.socket}:${path}`);
  }
}

export type Client = Client;
