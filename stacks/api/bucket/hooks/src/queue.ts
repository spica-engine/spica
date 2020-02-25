import {Action} from "@spica-server/bucket/hooks/proto";
import {Queue} from "@spica-server/function/queue";
import * as grpc from "grpc";

export class ActionQueue implements Queue<typeof Action.Queue> {
  TYPE = Action.Queue;

  callbacks = new Map<string, Function>();
  queue = new Map<string, Action.Action>();

  get size() {
    return this.queue.size;
  }

  pop(call: grpc.ServerUnaryCall<Action.Action.Pop>, callback: grpc.sendUnaryData<Action.Action>) {
    const action = this.queue.get(call.request.id);
    if (!this.queue.has(call.request.id)) {
      return callback(new Error(`Queue has no item with id ${call.request.id}`), null);
    }
    this.queue.delete(call.request.id);
    callback(null, action);
  }

  result(
    call: grpc.ServerUnaryCall<Action.Result>,
    callback: grpc.sendUnaryData<Action.Result.Response>
  ) {
    const _callback = this.callbacks.get(call.request.id);
    if (!this.callbacks.has(call.request.id)) {
      return callback(new Error(`Queue has no callback with id ${call.request.id}`), null);
    }
    this.callbacks.delete(call.request.id);
    _callback(JSON.parse(call.request.result));
    callback(null, new Action.Result.Response());
  }

  enqueue(id: string, action: Action.Action, callback: Function) {
    this.callbacks.set(id, callback);
    this.queue.set(id, action);
  }

  create() {
    return {
      pop: this.pop.bind(this),
      result: this.result.bind(this)
    };
  }
}
