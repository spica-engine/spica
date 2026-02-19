import {AgentTool} from "@spica-server/function/queue/proto";
import grpc from "@grpc/grpc-js";
import {Queue} from "./queue";

export class AgentToolQueue extends Queue<typeof AgentTool.UnimplementedQueueService.definition> {
  readonly TYPE = AgentTool.UnimplementedQueueService.definition;

  private queue = new Map<string, AgentTool.Message>();
  private resolvers = new Map<
    string,
    {resolve: (result: Uint8Array) => void; reject: (error: Error) => void}
  >();

  get size(): number {
    return this.queue.size;
  }

  enqueue(
    id: string,
    message: AgentTool.Message,
    resolve: (result: Uint8Array) => void,
    reject: (error: Error) => void
  ) {
    this.queue.set(id, message);
    this.resolvers.set(id, {resolve, reject});
  }

  dequeue(id: string) {
    this.queue.delete(id);
    this.resolvers.delete(id);
  }

  pop(
    call: grpc.ServerUnaryCall<AgentTool.Message.Pop, AgentTool.Message>,
    callback: grpc.sendUnaryData<AgentTool.Message>
  ) {
    if (!this.queue.has(call.request.id)) {
      callback(new Error(`Queue has no item with id ${call.request.id}`), undefined);
    } else {
      callback(undefined, this.queue.get(call.request.id));
      this.queue.delete(call.request.id);
    }
  }

  respond(
    call: grpc.ServerUnaryCall<AgentTool.Message, AgentTool.Message.Result>,
    callback: grpc.sendUnaryData<AgentTool.Message.Result>
  ) {
    const resolver = this.resolvers.get(call.request.id);
    if (!resolver) {
      callback(new Error(`No pending request with id ${call.request.id}`), undefined);
      return;
    }

    if (call.request.error && call.request.error.length > 0) {
      resolver.reject(new Error(Buffer.from(call.request.error).toString("utf-8")));
    } else {
      resolver.resolve(call.request.result);
    }

    this.resolvers.delete(call.request.id);
    callback(undefined, new AgentTool.Message.Result());
  }

  create() {
    return {
      pop: this.pop.bind(this),
      respond: this.respond.bind(this)
    };
  }
}
