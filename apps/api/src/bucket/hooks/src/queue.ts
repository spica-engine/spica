import {hooks} from "@spica/api/src/bucket/hooks/proto";
import {Queue} from "@spica/api/src/function/queue";
import * as grpc from "@grpc/grpc-js";

export class ChangeQueue implements Queue<typeof hooks.ChangeQueue> {
  TYPE = hooks.ChangeQueue;

  queue = new Map<string, hooks.Change>();

  get size() {
    return this.queue.size;
  }

  pop(
    call: grpc.ServerUnaryCall<hooks.Pop, hooks.Change>,
    callback: grpc.sendUnaryData<hooks.Change>
  ) {
    const action = this.queue.get(call.request.id);
    if (!this.queue.has(call.request.id)) {
      return callback(new Error(`ChangeQueue has no item with id ${call.request.id}`), null);
    }
    this.queue.delete(call.request.id);
    callback(null, action);
  }

  enqueue(id: string, action: hooks.Change) {
    this.queue.set(id, action);
  }

  create() {
    return {
      pop: this.pop.bind(this)
    };
  }
}
