import {RabbitMQ} from "@spica-server/function-queue-proto";
import grpc from "@grpc/grpc-js";
import type {ConsumeMessage} from "amqplib";

export type RabbitMQConsumeMessage = ConsumeMessage;

export {rabbitmqArguments} from "./rabbitmq/runtime.js";
export type {RuntimeStrategy} from "./rabbitmq/runtime.js";

export class RabbitMQQueue {
  private client: RabbitMQ.QueueClient;

  constructor() {
    const maxMessageSize = Number(process.env.FUNCTION_GRPC_MAX_MESSAGE_SIZE) || 25 * 1024 * 1024;
    this.client = new RabbitMQ.QueueClient(
      process.env.FUNCTION_GRPC_ADDRESS,
      grpc.credentials.createInsecure(),
      {
        "grpc.max_receive_message_length": maxMessageSize,
        "grpc.max_send_message_length": maxMessageSize
      }
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

  ack(e: RabbitMQ.Message.Settle) {
    return this.invoke("ack", e);
  }

  nack(e: RabbitMQ.Message.Settle) {
    return this.invoke("nack", e);
  }

  reject(e: RabbitMQ.Message.Settle) {
    return this.invoke("reject", e);
  }

  ackAll(e: RabbitMQ.Message.Settle) {
    return this.invoke("ackAll", e);
  }

  nackAll(e: RabbitMQ.Message.Settle) {
    return this.invoke("nackAll", e);
  }

  invoke<Request, Response>(method: string, e: Request): Promise<Response> {
    return new Promise((resolve, reject) => {
      (this.client as any)[method](e, (error: grpc.ServiceError | null, result: Response) => {
        if (error) {
          reject(new Error(error.details));
        } else {
          resolve(result);
        }
      });
    });
  }
}

export class RabbitMQMessage {
  content: Uint8Array<ArrayBufferLike>;
  fields: string;
  properties: string;
  errorMessage: Uint8Array<ArrayBufferLike>;
  mode: string;

  constructor(message: RabbitMQ.Message) {
    this.content = message.content;
    this.fields = message.fields;
    this.properties = message.properties;
    this.errorMessage = message.errorMessage;
    this.mode = message.mode;
  }
}

export class RabbitMQChannel {
  constructor(
    private eventId: string,
    private queue: RabbitMQQueue
  ) {}

  async ack(message: RabbitMQConsumeMessage, allUpTo = false): Promise<void> {
    await this.queue.ack(this.settle({allUpTo}));
  }

  async nack(message: RabbitMQConsumeMessage, allUpTo = false, requeue = true): Promise<void> {
    await this.queue.nack(this.settle({allUpTo, requeue}));
  }

  async reject(message: RabbitMQConsumeMessage, requeue = true): Promise<void> {
    await this.queue.reject(this.settle({requeue}));
  }

  async ackAll(): Promise<void> {
    await this.queue.ackAll(this.settle({}));
  }

  async nackAll(requeue = true): Promise<void> {
    await this.queue.nackAll(this.settle({requeue}));
  }

  private settle(options: {allUpTo?: boolean; requeue?: boolean}) {
    return new RabbitMQ.Message.Settle({id: this.eventId, ...options});
  }
}

export function reviveBuffers(_key: string, value: any) {
  const isSerializedBuffer =
    value?.type === "Buffer" && Array.isArray(value.data) && Object.keys(value).length === 2;
  return isSerializedBuffer ? Buffer.from(value.data) : value;
}
