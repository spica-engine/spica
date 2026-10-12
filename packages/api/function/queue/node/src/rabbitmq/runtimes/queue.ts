import {RabbitMQChannel, reviveBuffers} from "../../rabbitmq.js";
import type {RuntimeStrategy} from "../runtime.js";

export const queueRuntime: RuntimeStrategy = {
  mode: "queue",
  args(eventId, message, client) {
    return [
      {
        content: Buffer.from(message.content),
        fields: JSON.parse(message.fields, reviveBuffers),
        properties: JSON.parse(message.properties, reviveBuffers)
      },
      new RabbitMQChannel(eventId, client)
    ];
  }
};
