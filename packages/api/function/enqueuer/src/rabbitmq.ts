import {EventQueue, RabbitMQOptions, RabbitMQQueue} from "@spica-server/function-queue";
import {Enqueuer} from "./enqueuer.js";
import {Description} from "@spica-server/interface-function-enqueuer";
import {event, RabbitMQ} from "@spica-server/function-queue-proto";
import amqp from "amqplib";
import uniqid from "uniqid";
import {Logger} from "@nestjs/common";

export interface RabbitMQRetryPolicy {
  initialDelayMs: number;
  maxDelayMs: number;
}

export class RabbitMQEnqueuer extends Enqueuer<RabbitMQOptions> {
  type = event.Type.RABBITMQ;
  private readonly logger = new Logger(RabbitMQEnqueuer.name);

  description: Description = {
    title: "RabbitMQ",
    name: "rabbitmq",
    icon: "markunread_mailbox",
    description:
      "Designed for reliable background job processing and asynchronous event consumption."
  };

  private subscriptions: Subscription[] = [];

  constructor(
    private queue: EventQueue,
    private rabbitmqQueue: RabbitMQQueue,
    private retryPolicy: RabbitMQRetryPolicy = {initialDelayMs: 1_000, maxDelayMs: 60_000}
  ) {
    super();
  }

  subscribe(target: event.Target, options: RabbitMQOptions) {
    const subscription: Subscription = {target, options, cancelled: false, run: 0, attempt: 0};
    this.subscriptions.push(subscription);
    return this.connect(subscription);
  }

  unsubscribe(target: event.Target): void {
    const matching = this.subscriptions.filter(subscription => {
      const isCwdEqual = subscription.target.cwd == target.cwd;
      const isHandlerEqual = subscription.target.handler == target.handler;
      return target.handler ? isHandlerEqual && isCwdEqual : isCwdEqual;
    });

    matching.forEach(subscription => this.stop(subscription));
  }

  // Closing the connections makes RabbitMQ requeue whatever is unacked, so another consumer
  // picks it up.
  onEventsAreDrained(events: event.Event[]): Promise<any> {
    [...this.subscriptions].forEach(subscription => this.stop(subscription));
    return Promise.resolve();
  }

  private stop(subscription: Subscription) {
    subscription.cancelled = true;
    clearTimeout(subscription.timer);
    this.release(subscription);
    this.subscriptions.splice(this.subscriptions.indexOf(subscription), 1);
  }

  private async connect(subscription: Subscription) {
    const run = ++subscription.run;
    const isStale = () => subscription.cancelled || subscription.run !== run;
    const {options} = subscription;

    try {
      const connection = await this.attempt("Connection failed.", () => amqp.connect(options.url));
      if (isStale()) {
        return this.close(connection);
      }
      subscription.connection = connection;

      connection.on("error", err =>
        this.fail(subscription, run, `Connection error. ${err.message}`)
      );
      connection.on("close", () =>
        this.fail(subscription, run, "The connection was closed unexpectedly.")
      );
      connection.on("blocked", reason =>
        this.logger.warn(`Connection of ${this.describe(subscription)} is blocked: ${reason}`)
      );

      const channel = await this.attempt("Channel creation failed.", () =>
        connection.createChannel()
      );
      if (isStale()) {
        return this.close(connection);
      }
      subscription.channel = channel;

      channel.on("error", err => this.fail(subscription, run, `Channel error. ${err.message}`));
      channel.on("close", () =>
        this.fail(subscription, run, "The channel was closed unexpectedly.")
      );

      if (options.exchange) {
        await this.attempt("Exchange assertion failed.", () =>
          channel.assertExchange(options.exchange.name, options.exchange.type, {
            durable: options.exchange.durable
          })
        );
      }

      const q = await this.attempt("Queue assertion failed.", () =>
        channel.assertQueue(options.queue.name, {
          durable: options.queue.durable,
          exclusive: options.queue.exclusive
        })
      );

      if (options.exchange) {
        await this.attempt("Queue binding failed.", () =>
          channel.bindQueue(
            q.queue,
            options.exchange.name,
            options.exchange.pattern,
            options.exchange.headers
          )
        );
      }

      if (options.prefetch) {
        await this.attempt("Prefetch failed.", () => channel.prefetch(options.prefetch));
      }

      await this.attempt("Queue consumption failed.", () =>
        channel.consume(q.queue, msg => this.onMessage(subscription, run, channel, msg), {
          noAck: options.noAck
        })
      );

      if (isStale()) {
        return;
      }
      subscription.attempt = 0;
      subscription.lastError = undefined;
    } catch (error) {
      this.fail(subscription, run, error.message);
    }
  }

  private async attempt<T>(failureMessage: string, action: () => Promise<T>): Promise<T> {
    try {
      return await action();
    } catch (error) {
      throw new Error(`${failureMessage} ${error.message}`);
    }
  }

  private onMessage(
    subscription: Subscription,
    run: number,
    channel: amqp.Channel,
    msg: amqp.ConsumeMessage | null
  ) {
    if (subscription.cancelled || subscription.run !== run) {
      return;
    }

    // RabbitMQ signals a consumer cancelled on its side (e.g. the queue was deleted) with null.
    if (msg === null) {
      return this.fail(subscription, run, "The consumer was cancelled by the broker.");
    }

    const {target, options} = subscription;

    const ev = new event.Event({
      id: uniqid(),
      type: event.Type.RABBITMQ,
      target
    });

    const message = new RabbitMQ.Message({
      content: msg.content,
      fields: JSON.stringify(msg.fields),
      properties: JSON.stringify(msg.properties)
    });

    // With noAck the broker already forgot the message, settling it would kill the channel.
    const delivery = options.noAck ? undefined : {channel, deliveryTag: msg.fields.deliveryTag};

    this.rabbitmqQueue.enqueue(ev.id, message, delivery);
    this.queue.enqueue(ev);
  }

  private onErrorHandler(target: event.Target, errorMessage: string) {
    const ev = new event.Event({
      id: uniqid(),
      type: event.Type.RABBITMQ,
      target
    });

    const message = new RabbitMQ.Message({
      errorMessage: Buffer.from(errorMessage)
    });

    this.rabbitmqQueue.enqueue(ev.id, message);
    this.queue.enqueue(ev);
  }

  // Retries forever so a broker that is down for a while is picked up again without anyone
  // touching the function. The function is only told when the failure changes, not on every retry.
  private fail(subscription: Subscription, run: number, message: string) {
    if (subscription.cancelled || subscription.run !== run) {
      return;
    }

    // Invalidates this run: its late callbacks (a close after an error, a pending await) are ignored.
    subscription.run++;
    this.release(subscription);

    if (subscription.lastError !== message) {
      subscription.lastError = message;
      this.onErrorHandler(subscription.target, message);
    }

    const {initialDelayMs, maxDelayMs} = this.retryPolicy;
    const delay = Math.min(initialDelayMs * 2 ** subscription.attempt, maxDelayMs);
    subscription.attempt++;

    subscription.timer = setTimeout(() => this.connect(subscription), delay);
    subscription.timer.unref?.();
  }

  private release(subscription: Subscription) {
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

  private close(connection: amqp.ChannelModel) {
    return connection.close().catch(() => {});
  }

  private describe(subscription: Subscription) {
    return `${subscription.target.cwd}:${subscription.target.handler}`;
  }

  private closeErrorMessage(subscription: Subscription, error: Error) {
    return `Error on closing the channel of ${this.describe(subscription)}, reason: ${error.message}`;
  }
}

type Subscription = {
  target: event.Target;
  options: RabbitMQOptions;
  cancelled: boolean;
  run: number;
  attempt: number;
  lastError?: string;
  timer?: NodeJS.Timeout;
  connection?: amqp.ChannelModel;
  channel?: amqp.Channel;
};
