import {Http} from "@spica-server/function/queue/proto";
import * as grpc from "grpc";
import * as http from "http";
import {Queue} from "./queue";

export class HttpQueue extends Queue<typeof Http.Queue> {
  readonly TYPE = Http.Queue;

  private queue = new Map<string, Http.Request>();

  private streamMap = new Map<string, http.ServerResponse>();

  get size(): number {
    return this.queue.size;
  }

  enqueue(id: string, request: Http.Request, response: http.ServerResponse) {
    this.queue.set(id, request);
    this.streamMap.set(id, response);
  }

  write(call: grpc.ServerUnaryCall<Http.End>, callback: grpc.sendUnaryData<Http.End.Result>) {
    if (!this.streamMap.has(call.request.id)) {
      callback(new Error(`write: Queue has no item with id ${call.request.id}`), undefined);
    } else {
      const serverResponse = this.streamMap.get(call.request.id);
      serverResponse.write(call.request.data, call.request.encoding, error =>
        callback(error, error ? undefined : new Http.End.Result())
      );
    }
  }

  writeHead(
    call: grpc.ServerUnaryCall<Http.WriteHead>,
    callback: grpc.sendUnaryData<Http.WriteHead.Result>
  ) {
    if (!this.streamMap.has(call.request.id)) {
      callback(new Error(`Queue has no item with id ${call.request.id}`), undefined);
    } else {
      const serverResponse = this.streamMap.get(call.request.id);
      serverResponse.writeHead(
        call.request.statusCode,
        call.request.statusMessage,
        (call.request.headers || []).reduce((acc, header) => (acc[header.key] = header.value), {})
      );
      callback(undefined, new Http.WriteHead.Result());
    }
  }

  end(call: grpc.ServerUnaryCall<Http.End>, callback: grpc.sendUnaryData<Http.End.Result>) {
    if (!this.streamMap.has(call.request.id)) {
      callback(new Error(`Queue has no item with id ${call.request.id}`), undefined);
    } else {
      const serverResponse = this.streamMap.get(call.request.id);
      this.queue.delete(call.request.id);
      console.log(call.request.data);
      serverResponse.end(Buffer.from(call.request.data), call.request.encoding, () => {
        callback(undefined, new Http.End.Result());
      });
    }
  }

  pop(call: grpc.ServerUnaryCall<Http.Request.Pop>, callback: grpc.sendUnaryData<Http.Request>) {
    if (!this.queue.has(call.request.id)) {
      callback(new Error(`Queue has no item with id ${call.request.id}`), undefined);
    } else {
      callback(undefined, this.queue.get(call.request.id));
      this.queue.delete(call.request.id);
    }
  }

  create() {
    return {
      pop: this.pop.bind(this),
      write: this.write.bind(this),
      writeHead: this.writeHead.bind(this),
      end: this.end.bind(this)
    };
  }
}
