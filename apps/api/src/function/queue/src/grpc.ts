import {Grpc} from "@spica-server/function/queue/proto";
import grpc from "@grpc/grpc-js";
import {Queue} from "./queue";

export class GrpcQueue extends Queue<typeof Grpc.UnimplementedQueueService.definition> {
  readonly TYPE = Grpc.UnimplementedQueueService.definition;

  private queue = new Map<string, Grpc.Request>();
  private responseCallbacks = new Map<string, (response: Grpc.Response) => void>();

  get size(): number {
    return this.queue.size;
  }

  enqueue(id: string, request: Grpc.Request, responseCallback: (response: Grpc.Response) => void) {
    this.queue.set(id, request);
    this.responseCallbacks.set(id, responseCallback);
  }

  dequeue(id: string) {
    this.queue.delete(id);
    this.responseCallbacks.delete(id);
  }

  pop(
    call: grpc.ServerUnaryCall<Grpc.Request.Pop, Grpc.Request>,
    callback: grpc.sendUnaryData<Grpc.Request>
  ) {
    if (!this.queue.has(call.request.id)) {
      callback(new Error(`Queue has no item with id ${call.request.id}`), undefined);
    } else {
      callback(undefined, this.queue.get(call.request.id));
      this.queue.delete(call.request.id);
    }
  }

  respond(
    call: grpc.ServerUnaryCall<Grpc.Response, Grpc.Response.Result>,
    callback: grpc.sendUnaryData<Grpc.Response.Result>
  ) {
    const responseCallback = this.responseCallbacks.get(call.request.id);
    if (!responseCallback) {
      callback(
        {code: grpc.status.NOT_FOUND, details: "No pending response for this id"},
        undefined
      );
    } else {
      responseCallback(call.request);
      this.responseCallbacks.delete(call.request.id);
      callback(undefined, new Grpc.Response.Result());
    }
  }

  create() {
    return {
      pop: this.pop.bind(this),
      respond: this.respond.bind(this)
    };
  }
}
