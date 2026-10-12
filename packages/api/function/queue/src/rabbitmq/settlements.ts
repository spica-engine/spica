import {RabbitMQSettlement} from "./settlement.js";
import {QueueSettlement} from "./settlements/queue.js";
import {StreamSettlement} from "./settlements/stream.js";

export const RABBITMQ_SETTLEMENTS = (): RabbitMQSettlement[] => [new QueueSettlement(), new StreamSettlement()];
