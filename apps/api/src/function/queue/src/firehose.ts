import {Firehose} from "../proto";
import grpc from "@grpc/grpc-js";
import Websocket from "ws";
import {Queue} from "./queue";

export function parseMessage(message: Firehose.Message): {name: string; data?: unknown} {
  const parsedMessage: {name: string; data?: unknown} = {
    name: message.name
  };
  if (message.data) {
    parsedMessage.data = JSON.parse(message.data);
  }
  return parsedMessage;
}

export class FirehoseQueue extends Queue<typeof Firehose.Queue> {
  readonly TYPE = Firehose.Queue;

  private queue = new Map<string, Firehose.Message.Incoming>();

  private sockets = new Map<string, Websocket>();

  get size(): number {
    return this.queue.size;
  }

  constructor() {
    super();
  }

  enqueue(id: string, message: Firehose.Message.Incoming) {
    this.queue.set(id, message);
  }

  setSocket(message: Firehose.Message.Incoming, socket: Websocket) {
    this.sockets.set(message.client.id, socket);
  }

  removeSocket(message: Firehose.Message.Incoming) {
    this.sockets.delete(message.client.id);
  }

  pop(
    call: grpc.ServerUnaryCall<Firehose.Message.Pop, Firehose.Message.Incoming>,
    callback: grpc.sendUnaryData<Firehose.Message.Incoming>
  ) {
    if (!this.queue.has(call.request.id)) {
      callback(new Error(`Queue has no item with id ${call.request.id}`), undefined);
    } else {
      callback(undefined, this.queue.get(call.request.id));
      this.queue.delete(call.request.id);
    }
  }

  sendAll(
    call: grpc.ServerUnaryCall<Firehose.Message, Firehose.Message.Result>,
    callback: grpc.sendUnaryData<Firehose.Message.Result>
  ) {
    const message = JSON.stringify(parseMessage(call.request));
    for (const socket of this.sockets.values()) {
      if (socket.readyState == Websocket.OPEN) {
        socket.send(message);
      }
    }
    callback(undefined, new Firehose.Message.Result());
  }

  send(
    call: grpc.ServerUnaryCall<Firehose.Message.Outgoing, Firehose.Message.Result>,
    callback: grpc.sendUnaryData<Firehose.Message.Result>
  ) {
    const socket = this.sockets.get(call.request.client.id);

    if (!socket) {
      callback(new Error(`Can not find socket with id ${call.request.client.id}`), undefined);
    } else {
      if (socket.readyState != Websocket.OPEN) {
        callback(new Error(`Socket ${call.request.client.id} is not open.`), undefined);
      } else {
        socket.send(JSON.stringify(parseMessage(call.request.message)));
        callback(undefined, new Firehose.Message.Result());
      }
    }
  }

  close(
    call: grpc.ServerUnaryCall<Firehose.Close, Firehose.Close.Result>,
    callback: grpc.sendUnaryData<Firehose.Close.Result>
  ) {
    const socket = this.sockets.get(call.request.client.id);
    if (!socket) {
      callback(new Error(`Can not find socket with id ${call.request.client.id}`), undefined);
    } else {
      if (socket.readyState != Websocket.OPEN) {
        callback(new Error(`Socket ${call.request.client.id} is not open.`), undefined);
      } else {
        // 4000 is reserved for server-side close calls
        socket.close(4000);
        this.sockets.delete(call.request.client.id);
        callback(undefined, new Firehose.Message.Result());
      }
    }
  }

  create() {
    return {
      pop: this.pop.bind(this),
      sendAll: this.sendAll.bind(this),
      send: this.send.bind(this),
      close: this.close.bind(this)
    };
  }
}
