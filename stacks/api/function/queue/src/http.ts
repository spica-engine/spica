import {Http} from "@spica-server/function/queue/proto";
import * as grpc from "@grpc/grpc-js";
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

  dequeue(id: string) {
    this.queue.delete(id);
    this.streamMap.delete(id);
  }

  write(
    call: grpc.ServerUnaryCall<Http.Write, Http.Write.Result>,
    callback: grpc.sendUnaryData<Http.Write.Result>
  ) {
    if (!this.streamMap.has(call.request.id)) {
      callback({code: 1}, undefined);
    } else {
      const serverResponse = this.streamMap.get(call.request.id);
      serverResponse.write(Buffer.from(call.request.data), call.request.encoding, error =>
        callback(error, error ? undefined : new Http.Write.Result())
      );
    }
  }

  writeHead(
    call: grpc.ServerUnaryCall<Http.WriteHead, Http.WriteHead.Result>,
    callback: grpc.sendUnaryData<Http.WriteHead.Result>
  ) {
    if (!this.streamMap.has(call.request.id)) {
      callback({code: 1}, undefined);
    } else {
      const serverResponse = this.streamMap.get(call.request.id);
      serverResponse.writeHead(
        call.request.statusCode,
        call.request.statusMessage,
        (call.request.headers || []).reduce((headers, header) => {
          if (headers[header.key]) {
            const prevHeader = headers[header.key];
            if (!Array.isArray(prevHeader)) {
              headers[header.key] = [prevHeader];
            }
            headers[header.key].push(header.value);
          } else {
            headers[header.key] = header.value;
          }
          return headers;
        }, {})
      );
      callback(undefined, new Http.WriteHead.Result());
    }
  }

  end(
    call: grpc.ServerUnaryCall<Http.End, Http.End.Result>,
    callback: grpc.sendUnaryData<Http.End.Result>
  ) {
    if (!this.streamMap.has(call.request.id)) {
      callback({code: 1}, undefined);
    } else {
      const serverResponse = this.streamMap.get(call.request.id);
      this.queue.delete(call.request.id);
      if (call.request.data) {
        serverResponse.end(Buffer.from(call.request.data), call.request.encoding, () => {
          callback(undefined, new Http.End.Result());
        });
      } else {
        serverResponse.end(() => callback(undefined, new Http.End.Result()));
      }
    }
  }

  pop(
    call: grpc.ServerUnaryCall<Http.Request.Pop, Http.Request>,
    callback: grpc.sendUnaryData<Http.Request>
  ) {
    if (!this.queue.has(call.request.id)) {
      callback({code: 1}, undefined);
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
