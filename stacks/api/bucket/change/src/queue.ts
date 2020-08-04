import {DataChange} from "@spica-server/bucket/change/proto";
import * as grpc from "@grpc/grpc-js";
import {Queue} from "@spica-server/function/queue";

export class DataChangeQueue extends Queue<typeof DataChange.Queue> {
  readonly TYPE = DataChange.Queue;

  private queue = new Map<string, DataChange.Change>();

  get size(): number {
    return this.queue.size;
  }

  enqueue(id: string, change: DataChange.Change) {
    this.queue.set(id, change);
  }

  pop(
    call: grpc.ServerUnaryCall<DataChange.Change.Pop, DataChange.Change>,
    callback: grpc.sendUnaryData<DataChange.Change>
  ) {
    if (!this.queue.has(call.request.id)) {
      callback(new Error(`Queue has no item with id ${call.request.id}`), undefined);
    } else {
      callback(undefined, this.queue.get(call.request.id));
      this.queue.delete(call.request.id);
    }
  }

  create() {
    return {
      pop: this.pop.bind(this)
    };
  }
}
