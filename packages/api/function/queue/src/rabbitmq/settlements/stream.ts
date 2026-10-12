import {RabbitMQ} from "@spica-server/function-queue-proto";
import grpc from "@grpc/grpc-js";
import {RabbitMQSettlement} from "../settlement.js";

export interface StreamConsumerHandle {
  storeOffset(offset?: bigint): Promise<void>;
  queryOffset(): Promise<bigint>;
}

export interface RabbitMQStreamDelivery {
  token: string;
  consumer: StreamConsumerHandle;
}

export class StreamSettlement implements RabbitMQSettlement {
  readonly mode = "stream";
  readonly pending = 0;

  private consumers = new Map<string, StreamConsumerHandle>();

  track(_id: string, delivery: RabbitMQStreamDelivery) {
    this.consumers.set(delivery.token, delivery.consumer);
  }

  forget(_id: string) {}

  purge(owner: unknown) {
    for (const [token, consumer] of this.consumers) {
      if (consumer === owner) {
        this.consumers.delete(token);
      }
    }
  }

  handlers() {
    return {
      storeOffset: this.storeOffset.bind(this),
      queryOffset: this.queryOffset.bind(this)
    };
  }

  storeOffset(
    call: grpc.ServerUnaryCall<RabbitMQ.Message.StoreOffset, RabbitMQ.Message.Result>,
    callback: grpc.sendUnaryData<RabbitMQ.Message.Result>
  ) {
    const {consumer: token, offset} = call.request;
    this.run(token, callback, async consumer => {
      await consumer.storeOffset(BigInt(offset));
      return new RabbitMQ.Message.Result();
    });
  }

  queryOffset(
    call: grpc.ServerUnaryCall<RabbitMQ.Message.QueryOffset, RabbitMQ.Message.Offset>,
    callback: grpc.sendUnaryData<RabbitMQ.Message.Offset>
  ) {
    this.run(call.request.consumer, callback, async consumer => {
      const offset = await consumer.queryOffset();
      return new RabbitMQ.Message.Offset({offset: String(offset)});
    });
  }

  private async run<Result>(
    token: string,
    callback: grpc.sendUnaryData<Result>,
    action: (consumer: StreamConsumerHandle) => Promise<Result>
  ) {
    const consumer = this.consumers.get(token);

    if (!consumer) {
      return callback(
        {
          code: grpc.status.NOT_FOUND,
          details: `No active consumer for the token ${token}. The trigger was disabled or is reconnecting.`
        },
        null
      );
    }

    let result: Result;
    try {
      result = await action(consumer);
    } catch (error) {
      return callback({code: grpc.status.FAILED_PRECONDITION, details: error.message}, null);
    }
    callback(null, result);
  }
}
