import {RabbitMQ} from "@spica-server/function/queue/proto";
import grpc from "@grpc/grpc-js";
import {Queue} from "./queue";
import amqp from "amqplib";

export interface RabbitMQOptions {
  url: string;
  exchange?: {
    name: string;
    type: "direct" | "topic" | "fanout" | "headers";
    pattern: string;
    durable: boolean;
  };
  queue: {
    name: string;
    durable: boolean;
    exclusive?: boolean;
  };
  prefetch?: number;
  noAck: boolean;
}

export class RabbitMQQueue extends Queue<typeof RabbitMQ.UnimplementedQueueService.definition> {
  readonly TYPE = RabbitMQ.UnimplementedQueueService.definition;

  private queue = new Map<string, RabbitMQ.RabbitMQMessage>();

  private channelMap = new Map<string, {channel: amqp.Channel; options: RabbitMQOptions}>();

  get size(): number {
    return this.queue.size;
  }

  get(id: string) {
    return this.queue.get(id);
  }

  enqueue(
    id: string,
    message: RabbitMQ.RabbitMQMessage,
    channel: amqp.Channel,
    options: RabbitMQOptions
  ) {
    this.queue.set(id, message);
    this.channelMap.set(id, {channel, options});
  }

  dequeue(id: string) {
    this.queue.delete(id);
    this.channelMap.delete(id);
  }

  pop(
    call: grpc.ServerUnaryCall<RabbitMQ.RabbitMQMessage.Pop, RabbitMQ.RabbitMQMessage>,
    callback: grpc.sendUnaryData<RabbitMQ.RabbitMQMessage>
  ) {
    if (!this.queue.has(call.request.id)) {
      callback(new Error(`Queue has no item with id ${call.request.id}`), undefined);
    } else {
      callback(undefined, this.queue.get(call.request.id));
      this.queue.delete(call.request.id);
    }
  }

  ack(
    call: grpc.ServerUnaryCall<RabbitMQ.RabbitMQMessage, RabbitMQ.RabbitMQMessage.Result>,
    callback: grpc.sendUnaryData<RabbitMQ.RabbitMQMessage.Result>
  ) {
    if (!this.channelMap.has(call.request.id)) {
      callback({code: 1}, undefined);
    } else {
      const serverResponse = this.channelMap.get(call.request.id);
      if (call.request.id) {
        const msg = {
          content: Buffer.from(call.request.content),
          fields: JSON.parse(call.request.fields),
          properties: JSON.parse(call.request.properties)
        };

        serverResponse.channel.ack(msg);
      }
      this.dequeue(call.request.id);
    }
  }

  nack(
    call: grpc.ServerUnaryCall<RabbitMQ.RabbitMQMessage, RabbitMQ.RabbitMQMessage.Result>,
    callback: grpc.sendUnaryData<RabbitMQ.RabbitMQMessage.Result>
  ) {
    if (!this.channelMap.has(call.request.id)) {
      callback({code: 1}, undefined);
    } else {
      const serverResponse = this.channelMap.get(call.request.id);
      if (call.request.id) {
        const msg = {
          content: Buffer.from(call.request.content),
          fields: JSON.parse(call.request.fields),
          properties: JSON.parse(call.request.properties)
        };

        serverResponse.channel.nack(msg);
      }
      this.dequeue(call.request.id);
    }
  }

  create() {
    return {
      pop: this.pop.bind(this),
      ack: this.ack.bind(this),
      nack: this.nack.bind(this)
    };
  }
}
