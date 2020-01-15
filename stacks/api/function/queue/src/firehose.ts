import {Firehose} from "@spica-server/function/queue/proto";
import * as grpc from "grpc";
import {Queue} from "./queue";

export class FirehoseQueue extends Queue<any> {
  readonly TYPE = Firehose.Queue;

  private queue = new Map<string, Firehose.Message.Incoming>();

  get size(): number {
    return this.queue.size;
  }

  enqueue(id: string, change: Firehose.Message.Incoming) {
    this.queue.set(id, change);
  }

  pop(
    call: grpc.ServerUnaryCall<Firehose.Message.Pop>,
    callback: grpc.sendUnaryData<Firehose.Message.Incoming>
  ) {
    if (!this.queue.has(call.request.id)) {
      callback(new Error(`Queue has no item with id ${call.request.id}`), undefined);
    } else {
      callback(undefined, this.queue.get(call.request.id));
      this.queue.delete(call.request.id);
      console.log('called back');
    }
  }

  create() {
    return {
      pop: this.pop.bind(this),
      sendAll: () => console.log("sendAll"),
      send: () => console.log("sendAll"),
      close: () => console.log("sendAll")
    };
  }
}
