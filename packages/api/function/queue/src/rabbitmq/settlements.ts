import {RabbitMQSettlement} from "./settlement.js";
import {QueueSettlement} from "./settlements/queue.js";

export const RABBITMQ_SETTLEMENTS = (): RabbitMQSettlement[] => [new QueueSettlement()];
