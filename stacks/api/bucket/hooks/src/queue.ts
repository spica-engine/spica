import {Action} from "@spica-server/bucket/hooks/proto";
import {Queue} from "@spica-server/function/queue";
import * as grpc from "@grpc/grpc-js";

export class ActionQueue implements Queue<typeof Action.Queue> {
  TYPE = Action.Queue;

  callbacks = new Map<string, Function>();
  queue = new Map<string, Action.Action>();
  actions = new Map<string, Action.Action.Type>();

  get size() {
    return this.queue.size;
  }

  pop(
    call: grpc.ServerUnaryCall<Action.Action.Pop, Action.Action>,
    callback: grpc.sendUnaryData<Action.Action>
  ) {
    const action = this.queue.get(call.request.id);
    if (!this.queue.has(call.request.id)) {
      return callback(new Error(`Queue has no item with id ${call.request.id}`), null);
    }
    this.queue.delete(call.request.id);
    this.actions.set(call.request.id, action.type);
    callback(null, action);
  }

  result(
    call: grpc.ServerUnaryCall<Action.Result, Action.Result.Response>,
    callback: grpc.sendUnaryData<Action.Result.Response>
  ) {
    const _callback = this.callbacks.get(call.request.id);

    if (!this.callbacks.has(call.request.id)) {
      return callback(new Error(`Queue has no callback with id ${call.request.id}`), null);
    }
    const action = this.actions.get(call.request.id);

    this.actions.delete(call.request.id);
    this.callbacks.delete(call.request.id);

    let result = true;

    try {
      result = JSON.parse(call.request.result);
    } catch (error) {
      callback(new Error(error), null);
    }

    if (
      (action == Action.Action.Type.INSERT ||
        action == Action.Action.Type.UPDATE ||
        action == Action.Action.Type.DELETE) &&
      typeof result != "boolean"
    ) {
      callback(new Error("Return value type must be boolean."), null);
    } else if (
      (action == Action.Action.Type.GET || action == Action.Action.Type.INDEX) &&
      !Array.isArray(result)
    ) {
      callback(new Error("Return value type must be array."), null);
    } else if (action == Action.Action.Type.STREAM && typeof result != "object") {
      callback(new Error("Return value type must be object."), null);
    }

    callback(null, new Action.Result.Response());

    _callback(result);
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
