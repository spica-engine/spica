type Arguments = Record<string, any>;

export interface RabbitMQQueueOptions {
  mode?: "queue";
  url: string;
  socketOptions?: Record<string, any>;
  exchange?: {
    name: string;
    type: string;
    durable?: boolean;
    internal?: boolean;
    autoDelete?: boolean;
    alternateExchange?: string;
    arguments?: Arguments;
    passive?: boolean;
    pattern?: string | string[];
    headers?: Arguments;
  };
  bindings?: {
    exchange: string;
    pattern?: string | string[];
    arguments?: Arguments;
  }[];
  exchangeBindings?: {
    source: string;
    destination: string;
    pattern?: string | string[];
    arguments?: Arguments;
  }[];
  queue: {
    name: string;
    durable?: boolean;
    exclusive?: boolean;
    autoDelete?: boolean;
    messageTtl?: number;
    expires?: number;
    deadLetterExchange?: string;
    deadLetterRoutingKey?: string;
    maxLength?: number;
    maxPriority?: number;
    arguments?: Arguments;
    passive?: boolean;
  };
  prefetch?: number;
  prefetchGlobal?: boolean;
  consume?: {
    consumerTag?: string;
    exclusive?: boolean;
    priority?: number;
    noLocal?: boolean;
    arguments?: Arguments;
  };
  noAck?: boolean;
}

export type RabbitMQOptions = RabbitMQQueueOptions;
