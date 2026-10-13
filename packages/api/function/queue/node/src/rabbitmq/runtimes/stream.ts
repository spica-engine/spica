import {RabbitMQ} from "@spica-server/function-queue-proto";
import type {RabbitMQMessage, RabbitMQQueue} from "../../rabbitmq.js";
import {reviveBuffers} from "../../rabbitmq.js";
import type {RuntimeStrategy} from "../runtime.js";

export class RabbitMQStreamConsumer {
  constructor(
    private readonly token: string,
    private readonly messageOffset: bigint | undefined,
    private readonly client: RabbitMQQueue
  ) {}

  async storeOffset(offset: bigint | undefined = this.messageOffset): Promise<void> {
    await this.client.invoke(
      "storeOffset",
      new RabbitMQ.Message.StoreOffset({consumer: this.token, offset: String(offset)})
    );
  }
}

export function deserialize(message: RabbitMQMessage) {
  const {offset, ...stream} = JSON.parse(message.stream, reviveBuffers);
  return {...stream, offset: BigInt(offset), content: Buffer.from(message.content)};
}

export const streamRuntime: RuntimeStrategy = {
  mode: "stream",
  args(_eventId, message, client) {
    const deserialized = deserialize(message);
    return [
      deserialized,
      new RabbitMQStreamConsumer(message.consumer, deserialized.offset, client)
    ];
  }
};
