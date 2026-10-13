import {RabbitMQ} from "@spica-server/function-queue-proto";
import type {RabbitMQMessage, RabbitMQQueue} from "../../rabbitmq.js";
import {reviveBuffers} from "../../rabbitmq.js";
import type {RuntimeStrategy} from "../runtime.js";

export class RabbitMQStreamConsumer {
  constructor(
    private token: string,
    private messageOffset: bigint | undefined,
    private client: RabbitMQQueue
  ) {}

  async storeOffset(offset: bigint | undefined = this.messageOffset): Promise<void> {
    await this.client.invoke(
      "storeOffset",
      new RabbitMQ.Message.StoreOffset({consumer: this.token, offset: String(offset)})
    );
  }
}

export function reviveStreamValues(key: string, value: any) {
  switch (value?.type) {
    case "BigInt":
      return BigInt(value.value);
    case "Date":
      return new Date(value.value);
    case "AmqpByte":
      return {byteValue: value.value};
    default:
      return reviveBuffers(key, value);
  }
}

export function deserialize(message: RabbitMQMessage) {
  const stream = JSON.parse(message.stream, reviveStreamValues);
  return {...stream, content: Buffer.from(message.content)};
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
