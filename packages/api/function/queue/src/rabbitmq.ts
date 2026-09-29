import {RabbitMQ} from "@spica-server/function-queue-proto";
import grpc from "@grpc/grpc-js";
import {Queue} from "./queue.js";
import amqp from "amqplib";

type Arguments = Record<string, any>;

export interface RabbitMQOptions {
  url: string;
  socketOptions?: Record<string, any>;
  exchange?: {
    name: string;
    type: string;
    durable?: boolean;
    internal?: boolean;
    autoDelete?: boolean;
    alternateExchange?: string;
    arguments?: Arguments;
    passive?: boolean;
    pattern?: string | string[];
    headers?: Arguments;
  };
  bindings?: {
    exchange: string;
    pattern?: string | string[];
    arguments?: Arguments;
  }[];
  exchangeBindings?: {
    source: string;
    destination: string;
    pattern?: string | string[];
    arguments?: Arguments;
  }[];
  queue: {
    name: string;
    durable?: boolean;
    exclusive?: boolean;
    autoDelete?: boolean;
    messageTtl?: number;
    expires?: number;
    deadLetterExchange?: string;
    deadLetterRoutingKey?: string;
    maxLength?: number;
    maxPriority?: number;
    arguments?: Arguments;
    passive?: boolean;
  };
  prefetch?: number;
  prefetchGlobal?: boolean;
  consume?: {
    consumerTag?: string;
    exclusive?: boolean;
    priority?: number;
    noLocal?: boolean;
    arguments?: Arguments;
  };
  noAck?: boolean;
}

export interface RabbitMQDelivery {
  channel: amqp.Channel;
  deliveryTag: number;
}

type ReleaseScope = "delivery" | "upTo" | "channel";

export class RabbitMQQueue extends Queue<typeof RabbitMQ.UnimplementedQueueService.definition> {
  readonly TYPE = RabbitMQ.UnimplementedQueueService.definition;

  private queue = new Map<string, RabbitMQ.Message>();

  private deliveries = new Map<string, RabbitMQDelivery>();

  get size(): number {
    return this.queue.size;
  }

  get pendingDeliveries(): number {
    return this.deliveries.size;
  }

  get(id: string) {
    return this.queue.get(id);
  }

  enqueue(id: string, message: RabbitMQ.Message, delivery?: RabbitMQDelivery) {
    this.queue.set(id, message);
    if (delivery) {
      this.deliveries.set(id, delivery);
    }
  }

  dequeue(id: string) {
    this.queue.delete(id);
    this.deliveries.delete(id);
  }

  purge(channel: amqp.Channel) {
    for (const [id, delivery] of this.deliveries) {
      if (delivery.channel === channel) {
        this.deliveries.delete(id);
      }
    }
  }

  pop(
    call: grpc.ServerUnaryCall<RabbitMQ.Message.Pop, RabbitMQ.Message>,
    callback: grpc.sendUnaryData<RabbitMQ.Message>
  ) {
    if (!this.queue.has(call.request.id)) {
      callback(new Error(`Queue has no item with id ${call.request.id}`), undefined);
    } else {
      callback(undefined, this.queue.get(call.request.id));
      this.queue.delete(call.request.id);
    }
  }

  ack(
    call: grpc.ServerUnaryCall<RabbitMQ.Message.Settle, RabbitMQ.Message.Result>,
    callback: grpc.sendUnaryData<RabbitMQ.Message.Result>
  ) {
    const {allUpTo} = call.request;
    this.settle(call.request, callback, allUpTo ? "upTo" : "delivery", delivery =>
      delivery.channel.ack(toMessage(delivery), allUpTo)
    );
  }

  nack(
    call: grpc.ServerUnaryCall<RabbitMQ.Message.Settle, RabbitMQ.Message.Result>,
    callback: grpc.sendUnaryData<RabbitMQ.Message.Result>
  ) {
    const {allUpTo, requeue} = call.request;
    this.settle(call.request, callback, allUpTo ? "upTo" : "delivery", delivery =>
      delivery.channel.nack(toMessage(delivery), allUpTo, requeue)
    );
  }

  reject(
    call: grpc.ServerUnaryCall<RabbitMQ.Message.Settle, RabbitMQ.Message.Result>,
    callback: grpc.sendUnaryData<RabbitMQ.Message.Result>
  ) {
    const {requeue} = call.request;
    this.settle(call.request, callback, "delivery", delivery =>
      delivery.channel.reject(toMessage(delivery), requeue)
    );
  }

  ackAll(
    call: grpc.ServerUnaryCall<RabbitMQ.Message.Settle, RabbitMQ.Message.Result>,
    callback: grpc.sendUnaryData<RabbitMQ.Message.Result>
  ) {
    this.settle(call.request, callback, "channel", delivery => delivery.channel.ackAll());
  }

  nackAll(
    call: grpc.ServerUnaryCall<RabbitMQ.Message.Settle, RabbitMQ.Message.Result>,
    callback: grpc.sendUnaryData<RabbitMQ.Message.Result>
  ) {
    const {requeue} = call.request;
    this.settle(call.request, callback, "channel", delivery => delivery.channel.nackAll(requeue));
  }

  create() {
    return {
      pop: this.pop.bind(this),
      ack: this.ack.bind(this),
      nack: this.nack.bind(this),
      reject: this.reject.bind(this),
      ackAll: this.ackAll.bind(this),
      nackAll: this.nackAll.bind(this)
    };
  }

  private settle(
    request: RabbitMQ.Message.Settle,
    callback: grpc.sendUnaryData<RabbitMQ.Message.Result>,
    scope: ReleaseScope,
    send: (delivery: RabbitMQDelivery) => void
  ) {
    const delivery = this.deliveries.get(request.id);

    if (!delivery) {
      return callback(
        {
          code: grpc.status.NOT_FOUND,
          details: `No unsettled delivery for event ${request.id}. It was already settled, its channel was closed, or the trigger consumes with noAck.`
        },
        null
      );
    }

    try {
      send(delivery);
    } catch (error) {
      return callback({code: grpc.status.FAILED_PRECONDITION, details: error.message}, null);
    }

    this.release(request.id, delivery, scope);
    callback(null, new RabbitMQ.Message.Result());
  }

  private release(id: string, settled: RabbitMQDelivery, scope: ReleaseScope) {
    if (scope == "delivery") {
      this.deliveries.delete(id);
      return;
    }

    for (const [otherId, other] of this.deliveries) {
      const isCovered =
        other.channel === settled.channel &&
        (scope == "channel" || other.deliveryTag <= settled.deliveryTag);
      if (isCovered) {
        this.deliveries.delete(otherId);
      }
    }
  }
}

function toMessage(delivery: RabbitMQDelivery) {
  return {fields: {deliveryTag: delivery.deliveryTag}} as unknown as amqp.Message;
}
