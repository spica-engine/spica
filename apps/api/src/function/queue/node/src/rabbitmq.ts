import {RabbitMQ} from "@spica-server/function/queue/proto";
import grpc from "@grpc/grpc-js";

export class RabbitMQQueue {
  private client: RabbitMQ.QueueClient;

  constructor() {
    this.client = new RabbitMQ.QueueClient(
      process.env.FUNCTION_GRPC_ADDRESS,
      grpc.credentials.createInsecure()
    );
  }

  pop(e: RabbitMQ.Message.Pop): Promise<RabbitMQ.Message> {
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

  ack(e: RabbitMQ.Message): Promise<RabbitMQ.Message.Result> {
    return new Promise((resolve, reject) => {
      this.client.ack(e, (error, event) => {
        if (error) {
          reject(error);
        } else {
          resolve(event);
        }
      });
    });
  }

  nack(e: RabbitMQ.Message): Promise<RabbitMQ.Message.Result> {
    return new Promise((resolve, reject) => {
      this.client.nack(e, (error, event) => {
        if (error) {
          reject(error);
        } else {
          resolve(event);
        }
      });
    });
  }
}

export class RabbitMQMessage {
  content: Uint8Array<ArrayBufferLike>;
  fields: string;
  properties: string;

  constructor(message: RabbitMQ.Message) {
    this.content = message.content;
    this.fields = message.fields;
    this.properties = message.properties;
  }
}

export class RabbitMQChannel {
  constructor(
    private _ack: (e: RabbitMQ.Message) => Promise<void>,
    private _nack: (e: RabbitMQ.Message) => Promise<void>
  ) {}

  ack(msg: RabbitMQ.Message) {
    const message = new RabbitMQ.Message({
      content: new Uint8Array(msg.content),
      fields: JSON.stringify(msg.fields),
      properties: JSON.stringify(msg.properties)
    });
    return this._ack(message);
  }

  nack(msg: RabbitMQ.Message) {
    const message = new RabbitMQ.Message({
      content: new Uint8Array(msg.content),
      fields: JSON.stringify(msg.fields),
      properties: JSON.stringify(msg.properties)
    });
    return this._nack(message);
  }
}
