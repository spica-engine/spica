import {Firehose} from "@spica-server/function/queue/proto";

import * as grpc from "@grpc/grpc-js";

export class FirehoseQueue {
  private client: any;

  constructor() {
    this.client = new Firehose.QueueClient(
      process.env.FUNCTION_GRPC_ADDRESS,
      grpc.credentials.createInsecure()
    );
  }

  pop(e: Firehose.Message.Pop): Promise<Firehose.Message.Incoming> {
    return new Promise((resolve, reject) => {
      this.client.pop(e, (error, event) => {
        if (error) {
          reject(new Error(error.details));
        } else {
          resolve(event);
        }
      });
    });
  }

  send(e: Firehose.Message.Outgoing): Promise<Firehose.Message.Result> {
    return new Promise((resolve, reject) => {
      this.client.send(e, (error, event) => {
        if (error) {
          reject(new Error(error.details));
        } else {
          resolve(event);
        }
      });
    });
  }

  sendAll(e: Firehose.Message): Promise<Firehose.Message.Result> {
    return new Promise((resolve, reject) => {
      this.client.sendAll(e, (error, event) => {
        if (error) {
          reject(new Error(error.details));
        } else {
          resolve(event);
        }
      });
    });
  }

  close(e: Firehose.Close): Promise<Firehose.Close.Result> {
    return new Promise((resolve, reject) => {
      this.client.close(e, (error, event) => {
        if (error) {
          reject(new Error(error.details));
        } else {
          resolve(event);
        }
      });
    });
  }
}

export function createMessage(name: string, data: unknown): Firehose.Message {
  const message = new Firehose.Message({
    name
  });
  if (data != undefined || data != null) {
    message.data = JSON.stringify(data);
  }
  return message;
}

export class Message<T = unknown> {
  name: string;
  data: T;
  constructor(_message: Firehose.Message) {
    this.name = _message.name;
    if (_message.data) {
      this.data = JSON.parse(_message.data);
    }
  }
}

export class FirehosePool {
  readonly size: number;

  constructor(
    _description: Firehose.PoolDescription,
    private _send: (message: Firehose.Message) => void
  ) {
    this.size = _description.size;

    Object.defineProperty(this, "_send", {
      ...Object.getOwnPropertyDescriptor(this, "_send"),
      enumerable: false
    });
  }

  send(name: string, data: unknown): void {
    this._send(createMessage(name, data));
  }
}

export class FirehoseSocket {
  readonly id: string;
  readonly remoteAddress: string;

  constructor(
    _description: Firehose.ClientDescription,
    private _close: () => void,
    private _send: (message: Firehose.Message) => void
  ) {
    this.id = _description.id;
    this.remoteAddress = _description.remoteAddress;

    Object.defineProperty(this, "_send", {
      ...Object.getOwnPropertyDescriptor(this, "_send"),
      enumerable: false
    });

    Object.defineProperty(this, "_close", {
      ...Object.getOwnPropertyDescriptor(this, "_close"),
      enumerable: false
    });
  }

  send(name: string, data: unknown): void {
    this._send(createMessage(name, data));
  }

  close(): void {
    this._close();
  }
}
