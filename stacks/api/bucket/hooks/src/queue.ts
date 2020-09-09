import {hooks} from "@spica-server/bucket/hooks/proto";
import {Queue} from "@spica-server/function/queue";
import * as grpc from "@grpc/grpc-js";

export class ChangeAndReviewQueue implements Queue<typeof hooks.ChangeAndReviewQueue> {
  TYPE = hooks.ChangeAndReviewQueue;

  callbacks = new Map<string, Function>();
  queue = new Map<string, hooks.ChangeOrReview>();

  get size() {
    return this.queue.size;
  }

  pop(
    call: grpc.ServerUnaryCall<hooks.Pop, hooks.ChangeOrReview>,
    callback: grpc.sendUnaryData<hooks.ChangeOrReview>
  ) {
    const action = this.queue.get(call.request.id);
    if (!this.queue.has(call.request.id)) {
      return callback(
        new Error(`ChangeAndReviewQueue has no item with id ${call.request.id}`),
        null
      );
    }
    this.queue.delete(call.request.id);
    callback(null, action);
  }

  result(
    call: grpc.ServerUnaryCall<hooks.Review.Result, hooks.Review.Result.Response>,
    callback: grpc.sendUnaryData<hooks.Review.Result.Response>
  ) {
    if (!this.callbacks.has(call.request.id)) {
      return callback(
        new Error(`ChangeAndReviewQueue has no callback with id ${call.request.id}`),
        null
      );
    }

    const _callback = this.callbacks.get(call.request.id);
    this.callbacks.delete(call.request.id);

    const type = call.request.type;

    let result: object | Array<unknown> | boolean;
    let error: Error;

    if (call.request.result == undefined || call.request.result == null) {
      error = new Error(
        `Function did not return any review response. Expected a review response but got ${typeof call
          .request.result}`
      );
    }

    if (!error) {
      try {
        result = JSON.parse(call.request.result);
      } catch (parseError) {
        error = new Error(parseError);
      }
    }

    if (
      (type == hooks.Review.Type.INSERT ||
        type == hooks.Review.Type.UPDATE ||
        type == hooks.Review.Type.DELETE) &&
      typeof result != "boolean"
    ) {
      error = new Error("The returned Review object type must be a boolean.");
    } else if (
      (type == hooks.Review.Type.GET || type == hooks.Review.Type.INDEX) &&
      !Array.isArray(result)
    ) {
      error = new Error("The returned Review object must be an array.");
    } else if (type == hooks.Review.Type.STREAM && typeof result != "object") {
      error = new Error("The returned Review object must be an object.");
    }

    if (error) {
      callback(error, null);
    } else {
      callback(null, new hooks.Review.Result.Response());
    }

    _callback(result);
  }

  enqueue(id: string, action: hooks.ChangeOrReview, callback?: Function) {
    if (callback) {
      this.callbacks.set(id, callback);
    }
    this.queue.set(id, action);
  }

  create() {
    return {
      pop: this.pop.bind(this),
      result: this.result.bind(this)
    };
  }
}
