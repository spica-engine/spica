import {RabbitMQ} from "@spica-server/function-queue-proto";
import grpc from "@grpc/grpc-js";
import {RabbitMQSettlement} from "../settlement.js";

export interface StreamConsumerHandle {
  storeOffset(offset?: bigint): Promise<void>;
}

export interface RabbitMQStreamDelivery {
  token: string;
  consumer: StreamConsumerHandle;
}

export class StreamSettlement implements RabbitMQSettlement {
  readonly mode = "stream";
  readonly pending = 0;

  private readonly consumers = new Map<string, StreamConsumerHandle>();

  track(_id: string, delivery: RabbitMQStreamDelivery) {
    this.consumers.set(delivery.token, delivery.consumer);
  }

  forget(_id: string) {
    // Offsets are stored explicitly by the function, so there is nothing to release per message.
  }

  purge(owner: unknown) {
    for (const [token, consumer] of this.consumers) {
      if (consumer === owner) {
        this.consumers.delete(token);
      }
    }
  }

  handlers() {
    return {
      storeOffset: this.storeOffset.bind(this)
    };
  }

  storeOffset(
    call: grpc.ServerUnaryCall<RabbitMQ.Message.StoreOffset, RabbitMQ.Message.Result>,
    callback: grpc.sendUnaryData<RabbitMQ.Message.Result>
  ) {
    const {consumer: token, offset} = call.request;
    void this.run(token, callback, async consumer => {
      await consumer.storeOffset(BigInt(offset));
      return new RabbitMQ.Message.Result();
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
