import {Database} from "@spica/api/src/function/queue/proto";
import * as grpc from "@grpc/grpc-js";
import {Queue} from "./queue";

export class DatabaseQueue extends Queue<typeof Database.Queue> {
  readonly TYPE = Database.Queue;

  private queue = new Map<string, Database.Change>();

  get size(): number {
    return this.queue.size;
  }

  get(id: string) {
    return this.queue.get(id);
  }

  enqueue(id: string, change: Database.Change) {
    this.queue.set(id, change);
  }

  pop(
    call: grpc.ServerUnaryCall<Database.Change.Pop, Database.Change>,
    callback: grpc.sendUnaryData<Database.Change>
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
