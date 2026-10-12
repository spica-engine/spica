import {RabbitMQ} from "@spica-server/function-queue-proto";
import grpc from "@grpc/grpc-js";
import amqp from "amqplib";
import {RabbitMQSettlement} from "../settlement.js";

export interface RabbitMQDelivery {
  channel: amqp.Channel;
  deliveryTag: number;
}

type ReleaseScope = "delivery" | "upTo" | "channel";

type SettleCall = grpc.ServerUnaryCall<RabbitMQ.Message.Settle, RabbitMQ.Message.Result>;
type SettleCallback = grpc.sendUnaryData<RabbitMQ.Message.Result>;

export class QueueSettlement implements RabbitMQSettlement {
  readonly mode = "queue";

  private deliveries = new Map<string, RabbitMQDelivery>();

  get pending(): number {
    return this.deliveries.size;
  }

  track(id: string, delivery: RabbitMQDelivery) {
    this.deliveries.set(id, delivery);
  }

  forget(id: string) {
    this.deliveries.delete(id);
  }

  purge(channel: unknown) {
    for (const [id, delivery] of this.deliveries) {
      if (delivery.channel === channel) {
        this.deliveries.delete(id);
      }
    }
  }

  handlers() {
    return {
      ack: this.ack.bind(this),
      nack: this.nack.bind(this),
      reject: this.reject.bind(this),
      ackAll: this.ackAll.bind(this),
      nackAll: this.nackAll.bind(this)
    };
  }

  ack(call: SettleCall, callback: SettleCallback) {
    const {allUpTo} = call.request;
    this.settle(call.request, callback, allUpTo ? "upTo" : "delivery", delivery =>
      delivery.channel.ack(toMessage(delivery), allUpTo)
    );
  }

  nack(call: SettleCall, callback: SettleCallback) {
    const {allUpTo, requeue} = call.request;
    this.settle(call.request, callback, allUpTo ? "upTo" : "delivery", delivery =>
      delivery.channel.nack(toMessage(delivery), allUpTo, requeue)
    );
  }

  reject(call: SettleCall, callback: SettleCallback) {
    const {requeue} = call.request;
    this.settle(call.request, callback, "delivery", delivery =>
      delivery.channel.reject(toMessage(delivery), requeue)
    );
  }

  ackAll(call: SettleCall, callback: SettleCallback) {
    this.settle(call.request, callback, "channel", delivery => delivery.channel.ackAll());
  }

  nackAll(call: SettleCall, callback: SettleCallback) {
    const {requeue} = call.request;
    this.settle(call.request, callback, "channel", delivery => delivery.channel.nackAll(requeue));
  }

  private settle(
    request: RabbitMQ.Message.Settle,
    callback: SettleCallback,
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
