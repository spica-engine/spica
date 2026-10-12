import {RabbitMQQueue} from "@spica-server/function-queue";
import {RabbitMQStrategy} from "./strategy.js";
import {QueueStrategy} from "./strategies/queue.js";

export const RABBITMQ_STRATEGIES = (rabbitmqQueue: RabbitMQQueue): RabbitMQStrategy[] => [
  new QueueStrategy(rabbitmqQueue)
];
