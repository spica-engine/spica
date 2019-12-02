import {Http} from "@spica-server/function/queue/proto";
import * as grpc from "grpc";
import {Queue} from "./queue";

export class HttpQueue extends Queue<typeof Http.Queue> {
  readonly TYPE = Http.Queue;

  private queue = new Array<Http.Request>();

  enqueue(req: Http.Request) {
    this.queue.push(req);
  }

  write() {}

  writeHead() {}

  pop(_: grpc.ServerUnaryCall<Http.Request.Pop>, callback: grpc.sendUnaryData<Http.Request>) {
    if (this.queue.length < 1) {
      callback(new Error("Queue is empty."), undefined);
    } else {
      callback(undefined, this.queue.pop());
    }
  }

  create() {
    return {
      pop: this.pop.bind(this),
      write: this.write.bind(this),
      writeHead: this.writeHead.bind(this)
    };
  }
}
