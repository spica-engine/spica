import {Grpc} from "@spica-server/function/queue/proto";
import grpc from "@grpc/grpc-js";
import {Queue} from "./queue";

export interface GrpcCall {
  sendMetadata: (metadata: grpc.Metadata) => void;
  sendMessage: (message: any) => void;
  end: () => void;
  cancelled: boolean;
}

export interface GrpcServiceOptions {
  host: string;
  port: number;
  service: string;
}

export class GrpcQueue extends Queue<typeof Grpc.UnimplementedQueueService.definition> {
  readonly TYPE = Grpc.UnimplementedQueueService.definition;

  private queue = new Map<string, Grpc.Request>();

  private callMap = new Map<string, GrpcCall>();

  get size(): number {
    return this.queue.size;
  }

  get(id: string) {
    return {
      request: this.queue.get(id),
      call: this.callMap.get(id)
    };
  }

  enqueue(id: string, request: Grpc.Request, call: GrpcCall) {
    this.queue.set(id, request);
    this.callMap.set(id, call);
  }

  dequeue(id: string) {
    this.queue.delete(id);
    this.callMap.delete(id);
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

  sendResponse(
    call: grpc.ServerUnaryCall<Grpc.Response, Grpc.Response.Result>,
    callback: grpc.sendUnaryData<Grpc.Response.Result>
  ) {
    if (!this.callMap.has(call.request.id)) {
      callback({code: 1, message: "Call not found"} as any, undefined);
    } else {
      const grpcCall = this.callMap.get(call.request.id);

      if (grpcCall.cancelled) {
        callback({code: 1, message: "Call was cancelled"} as any, undefined);
        return;
      }

      // Send metadata if present
      if (call.request.metadata && call.request.metadata.length > 0) {
        const metadata = new grpc.Metadata();
        call.request.metadata.forEach(header => {
          metadata.add(header.key, header.value);
        });
        grpcCall.sendMetadata(metadata);
      }

      // Send response data
      const responseData = call.request.data
        ? JSON.parse(Buffer.from(call.request.data).toString())
        : {};
      grpcCall.sendMessage(responseData);
      grpcCall.end();

      this.dequeue(call.request.id);
      callback(undefined, new Grpc.Response.Result());
    }
  }

  create() {
    return {
      pop: this.pop.bind(this),
      sendResponse: this.sendResponse.bind(this),
      sendError: this.sendError.bind(this)
    };
  }

  sendError(
    call: grpc.ServerUnaryCall<Grpc.Error, Grpc.Error.Result>,
    callback: grpc.sendUnaryData<Grpc.Error.Result>
  ) {
    if (!this.callMap.has(call.request.id)) {
      callback({code: 1, message: "Call not found"} as any, undefined);
    } else {
      const grpcCall = this.callMap.get(call.request.id);

      if (grpcCall.cancelled) {
        callback({code: 1, message: "Call was already cancelled"} as any, undefined);
        return;
      }

      // Send error with metadata if present
      const metadata = new grpc.Metadata();
      if (call.request.metadata && call.request.metadata.length > 0) {
        call.request.metadata.forEach(header => {
          metadata.add(header.key, header.value);
        });
      }

      const error: grpc.ServiceError = {
        name: "GrpcError",
        message: call.request.message || "Internal server error",
        code: call.request.code || grpc.status.INTERNAL,
        details: call.request.message,
        metadata
      };

      // Note: For unary calls, we use the callback to send the error
      // The actual implementation depends on your gRPC call type
      callback(error, undefined);

      this.dequeue(call.request.id);
    }
  }
}
