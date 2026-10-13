import {RabbitMQ} from "@spica-server/function-queue-proto";
import {RabbitMQQueue, RabbitMQStreamOptions} from "@spica-server/function-queue";
import {Logger} from "@nestjs/common";
import uniqid from "uniqid";
import {
  Client,
  ClientParams,
  connect,
  Consumer,
  ConsumerFilter,
  Offset
} from "rabbitmq-stream-js-client";
import {
  creditsOnChunkCompleted,
  creditsOnChunkReceived
} from "rabbitmq-stream-js-client/dist/consumer_credit_policy.js";
import {attempt, RabbitMQStrategy, Session, Subscription} from "../strategy.js";
import {serialize} from "./stream-message.js";

type StreamResources = {
  client: Client;
  consumer: Consumer;
  token: string;
};

export type StreamSubscription = Subscription<RabbitMQStreamOptions, StreamResources>;

type ConsumerOptions = NonNullable<RabbitMQStreamOptions["consumer"]>;

export class StreamStrategy implements RabbitMQStrategy<RabbitMQStreamOptions, StreamResources> {
  readonly mode = "stream";
  private readonly logger = new Logger(StreamStrategy.name);

  constructor(private rabbitmqQueue: RabbitMQQueue) {}

  async open(subscription: StreamSubscription, session: Session) {
    const {connection, stream, consumer: consumerOptions} = subscription.options;
    subscription.token ??= uniqid();

    const client = await attempt("Connection failed.", () =>
      connect({
        ...connection,
        listeners: {
          connection_closed: () => session.fail("The connection was closed unexpectedly."),
          metadata_update: () => session.fail("The stream metadata changed. (deleted or moved)")
        }
      } as ClientParams)
    );
    if (session.isStale()) {
      return this.close(client);
    }
    subscription.client = client;

    if (!stream.passive) {
      await attempt("Stream creation failed.", () =>
        client.createStream({stream: stream.name, arguments: stream.arguments})
      );
    }

    const resolveOffset = () => this.resolveOffset(subscription, client);
    const startOffset = await attempt("Consumer declaration failed.", resolveOffset);

    const declaration = client.declareConsumer(
      {
        stream: stream.name,
        offset: startOffset,
        consumerRef: consumerOptions.consumerRef,
        singleActive: consumerOptions.singleActive,
        consumerTag: consumerOptions.consumerTag,
        filter: consumerOptions.filter && {
          values: consumerOptions.filter.values,
          matchUnfiltered: consumerOptions.filter.matchUnfiltered ?? false,
          postFilterFunc: () => true
        },
        creditPolicy: toCreditPolicy(consumerOptions.creditPolicy),
        connectionClosedListener: () =>
          session.fail("The consumer connection was closed unexpectedly."),
        consumerUpdateListener: consumerOptions.singleActive ? resolveOffset : undefined
      },
      msg => this.onMessage(subscription, session, declaration, msg)
    );

    const consumer = await attempt("Consumer declaration failed.", () => declaration);
    if (session.isStale()) {
      return this.close(client);
    }
    subscription.consumer = consumer;
  }

  release(subscription: StreamSubscription) {
    const {client, consumer} = subscription;
    subscription.client = undefined;
    subscription.consumer = undefined;

    if (consumer) {
      this.rabbitmqQueue.purge(consumer);
      consumer
        .close()
        .catch(error => this.logger.debug(this.closeErrorMessage(subscription, error)));
    }
    if (client) {
      this.close(client);
    }
  }

  private async resolveOffset(subscription: StreamSubscription, client: Client) {
    const {stream, consumer} = subscription.options;

    if (consumer.consumerRef) {
      const stored = await client
        .queryOffset({reference: consumer.consumerRef, stream: stream.name})
        .catch(() => undefined);
      if (stored !== undefined) {
        return Offset.offset(stored + 1n);
      }
    }

    return toOffset(consumer.offset);
  }

  private async onMessage(
    subscription: StreamSubscription,
    session: Session,
    declaration: Promise<Consumer>,
    msg: Parameters<Parameters<Client["declareConsumer"]>[1]>[0]
  ) {
    const consumer = await declaration.catch(() => undefined);
    if (!consumer || session.isStale()) {
      return;
    }

    const message = new RabbitMQ.Message({
      content: msg.content,
      stream: serialize(msg),
      consumer: subscription.token
    });

    session.deliver(message, {token: subscription.token, consumer});
  }

  private close(client: Client) {
    return client.close().catch(() => {});
  }

  private closeErrorMessage(subscription: StreamSubscription, error: Error) {
    return `Error on closing the consumer of ${subscription.target.cwd}:${subscription.target.handler}, reason: ${error.message}`;
  }
}

function toOffset(offset: ConsumerOptions["offset"]) {
  switch (offset.type) {
    case "first":
      return Offset.first();
    case "last":
      return Offset.last();
    case "offset":
      return Offset.offset(BigInt(offset.value));
    case "timestamp":
      return Offset.timestamp(new Date(offset.value));
    case "next":
      return Offset.next();
  }
}

function toCreditPolicy(policy: ConsumerOptions["creditPolicy"]) {
  if (!policy) {
    return undefined;
  }
  const create =
    policy.type === "onChunkReceived" ? creditsOnChunkReceived : creditsOnChunkCompleted;
  return create(policy.startFrom ?? 1, policy.step ?? 1);
}
