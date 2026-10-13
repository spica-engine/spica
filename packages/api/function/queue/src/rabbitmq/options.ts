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

export interface RabbitMQStreamOptions {
  mode: "stream";
  connection: {
    hostname: string;
    username: string;
    password: string;
    port?: number;
    vhost?: string;
    mechanism?: "PLAIN" | "EXTERNAL";
    frameMax?: number;
    heartbeat?: number;
    socketTimeout?: number;
    connectionName?: string;
    ssl?:
      | boolean
      | {
          key?: string;
          cert?: string;
          ca?: string;
          rejectUnauthorized?: boolean;
        };
    addressResolver?: {enabled: true; endpoint?: {host: string; port: number}} | {enabled: false};
    bufferSizeSettings?: {initialSize?: number; maxRatio?: number; multiplier?: number};
  };
  stream: {
    name: string;
    passive?: boolean;
    arguments?: {
      "max-age"?: string;
      "max-length-bytes"?: number;
      "stream-max-segment-size-bytes"?: number;
      "initial-cluster-size"?: number;
      "queue-leader-locator"?: "random" | "client-local" | "least-leaders";
      [key: string]: unknown;
    };
  };
  consumer: {
    offset:
      | {type: "first" | "last" | "next"}
      | {type: "offset" | "timestamp"; value: number | string};
    consumerRef?: string;
    singleActive?: boolean;
    consumerTag?: string;
    filter?: {values: string[]; matchUnfiltered?: boolean};
    creditPolicy?: {
      type: "onChunkReceived" | "onChunkCompleted";
      startFrom?: number;
      step?: number;
    };
  };
}

export type RabbitMQOptions = RabbitMQQueueOptions | RabbitMQStreamOptions;
