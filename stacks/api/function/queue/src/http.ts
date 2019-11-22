import {HttpQueueService, HttpRequest, IHttpQueueService} from "@spica-server/function/queue/proto";
import {Queue} from "./queue";
import * as grpc from "grpc";

export class HttpQueue extends Queue<IHttpQueueService> {
  readonly TYPE = HttpQueueService;

  private queue = new Array<HttpRequest>();

  enqueue(req: HttpRequest) {
    this.queue.push(req);
  }

  write() {}

  writeHead() {}

  pop(_: grpc.ServerUnaryCall<HttpRequest>, callback: grpc.sendUnaryData<HttpRequest>) {
    if (this.queue.length < 1) {
      callback(new Error("Queue is empty."), undefined);
    } else {
      callback(undefined, this.queue.pop());
    }
  }

  create(): IHttpQueueService {
    return {
      pop: this.pop.bind(this),
      write: this.write.bind(this),
      writeHead: this.writeHead.bind(this)
    };
  }
}
