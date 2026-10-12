import {RabbitMQ} from "@spica-server/function-queue-proto";
import {RabbitMQQueue, RabbitMQQueueOptions} from "@spica-server/function-queue";
import {Logger} from "@nestjs/common";
import amqp from "amqplib";
import {attempt, RabbitMQStrategy, Session, Subscription} from "../strategy.js";

type QueueResources = {connection: amqp.ChannelModel; channel: amqp.Channel};

export type QueueSubscription = Subscription<RabbitMQQueueOptions, QueueResources>;

export class QueueStrategy implements RabbitMQStrategy<RabbitMQQueueOptions, QueueResources> {
  readonly mode = "queue";
  private readonly logger = new Logger(QueueStrategy.name);

  constructor(private rabbitmqQueue: RabbitMQQueue) {}

  async open(subscription: QueueSubscription, session: Session) {
    const {options} = subscription;

    const connection = await attempt("Connection failed.", () =>
      amqp.connect(options.url, options.socketOptions)
    );
    if (session.isStale()) {
      return this.close(connection);
    }
    subscription.connection = connection;

    connection.on("error", err => session.fail(`Connection error. ${err.message}`));
    connection.on("close", () => session.fail("The connection was closed unexpectedly."));
    connection.on("blocked", reason =>
      this.logger.warn(`Connection of ${this.describe(subscription)} is blocked: ${reason}`)
    );

    const channel = await attempt("Channel creation failed.", () => connection.createChannel());
    if (session.isStale()) {
      return this.close(connection);
    }
    subscription.channel = channel;

    channel.on("error", err => session.fail(`Channel error. ${err.message}`));
    channel.on("close", () => session.fail("The channel was closed unexpectedly."));

    await this.setUp(subscription, session, channel);
  }

  release(subscription: QueueSubscription) {
    const {channel, connection} = subscription;
    subscription.channel = undefined;
    subscription.connection = undefined;

    if (channel) {
      this.rabbitmqQueue.purge(channel);
      channel
        .close()
        .catch(error => this.logger.debug(this.closeErrorMessage(subscription, error)));
    }
    if (connection) {
      this.close(connection);
    }
  }

  private async setUp(subscription: QueueSubscription, session: Session, channel: amqp.Channel) {
    const {options} = subscription;
    const {exchange, queue} = options;

    if (exchange) {
      await attempt("Exchange assertion failed.", () =>
        exchange.passive
          ? channel.checkExchange(exchange.name)
          : channel.assertExchange(exchange.name, exchange.type, exchange)
      );
    }

    const q = await attempt("Queue assertion failed.", () =>
      queue.passive ? channel.checkQueue(queue.name) : channel.assertQueue(queue.name, queue)
    );

    const queueBindings = [
      ...(exchange
        ? [{exchange: exchange.name, pattern: exchange.pattern, arguments: exchange.headers}]
        : []),
      ...(options.bindings ?? [])
    ];
    for (const binding of queueBindings) {
      for (const pattern of patternsOf(binding.pattern)) {
        await attempt("Queue binding failed.", () =>
          channel.bindQueue(q.queue, binding.exchange, pattern, binding.arguments)
        );
      }
    }

    for (const binding of options.exchangeBindings ?? []) {
      for (const pattern of patternsOf(binding.pattern)) {
        await attempt("Exchange binding failed.", () =>
          channel.bindExchange(binding.destination, binding.source, pattern, binding.arguments)
        );
      }
    }

    if (options.prefetch) {
      await attempt("Prefetch failed.", () =>
        channel.prefetch(options.prefetch, options.prefetchGlobal)
      );
    }

    await attempt("Queue consumption failed.", () =>
      channel.consume(q.queue, msg => this.onMessage(options, session, channel, msg), {
        ...options.consume,
        noAck: options.noAck
      })
    );
  }

  private onMessage(
    options: RabbitMQQueueOptions,
    session: Session,
    channel: amqp.Channel,
    msg: amqp.ConsumeMessage | null
  ) {
    if (session.isStale()) {
      return;
    }

    if (msg === null) {
      return session.fail("The consumer was cancelled by the broker.");
    }

    const message = new RabbitMQ.Message({
      content: msg.content,
      fields: JSON.stringify(msg.fields),
      properties: JSON.stringify(msg.properties)
    });

    const delivery = options.noAck ? undefined : {channel, deliveryTag: msg.fields.deliveryTag};

    session.deliver(message, delivery);
  }

  private close(connection: amqp.ChannelModel) {
    return connection.close().catch(() => {});
  }

  private describe(subscription: QueueSubscription) {
    return `${subscription.target.cwd}:${subscription.target.handler}`;
  }

  private closeErrorMessage(subscription: QueueSubscription, error: Error) {
    return `Error on closing the channel of ${this.describe(subscription)}, reason: ${error.message}`;
  }
}

function patternsOf(pattern: string | string[] | undefined) {
  return Array.isArray(pattern) ? pattern : [pattern ?? ""];
}
