import type {RabbitMQMessage, RabbitMQQueue} from "../rabbitmq.js";
import {RABBITMQ_RUNTIMES} from "./runtimes.js";

export interface RuntimeStrategy {
  readonly mode: string;
  args(eventId: string, message: RabbitMQMessage, client: RabbitMQQueue): unknown[];
}

const DEFAULT_MODE = "queue";

export function rabbitmqArguments(
  eventId: string,
  message: RabbitMQMessage,
  client: RabbitMQQueue
): unknown[] {
  const mode = message.mode || DEFAULT_MODE;
  const runtime = RABBITMQ_RUNTIMES.find(candidate => candidate.mode === mode);
  if (!runtime) {
    throw new Error(`No runtime is registered for the rabbitmq mode "${mode}".`);
  }
  return runtime.args(eventId, message, client);
}
