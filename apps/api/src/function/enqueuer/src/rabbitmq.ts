import {EventQueue, RabbitMQOptions, RabbitMQQueue} from "@spica-server/function/queue";
import {Enqueuer} from "./enqueuer";
import {Description} from "@spica-server/interface/function/enqueuer";
import {event, RabbitMQ} from "@spica-server/function/queue/proto";
import amqp from "amqplib";
import uniqid from "uniqid";

export class RabbitMQEnqueuer extends Enqueuer<RabbitMQOptions> {
  type = event.Type.RABBITMQ;

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
    private schedulerUnsubscription: (targetId: string) => void
  ) {
    super();

    setInterval(() => {
      this.subscriptions.forEach(s => {
        if (!s.closed) return;

        this.unsubscribe(s.target);
        this.subscribe(s.target, s.options);
      });
    }, 60_000);
  }

  async subscribe(target: event.Target, options: RabbitMQOptions) {
    const subscription: Subscription = {target, options, closed: false};
    this.subscriptions.push(subscription);

    const connection = await amqp.connect(options.url).catch(err => {
      subscription.closed = true;

      this.onErrorHandler(target, "Connection failed. " + err.message);
      return null;
    });

    if (!connection) return;

    subscription.connection = connection;

    connection.on("close", () => {
      this.setAsClosed({
        connection,
        target,
        errorMessage: "The connection was closed unexpectedly."
      });
    });

    const channel = await connection.createChannel().catch(err => {
      this.setAsClosed({
        connection,
        target,
        errorMessage: "Channel creation failed. " + err.message
      });
      return null;
    });
    if (!channel) return;

    subscription.channel = channel;

    channel.on("error", err => {
      this.setAsClosed({
        channel,
        target,
        errorMessage: "Channel error. " + err.message
      });
    });

    channel.on("close", () => {
      this.setAsClosed({
        channel,
        target,
        errorMessage: "The channel was closed unexpectedly."
      });
    });

    if (options.exchange) {
      await channel
        .assertExchange(options.exchange.name, options.exchange.type, {
          durable: options.exchange.durable
        })
        .catch(err => {
          this.setAsClosed({
            channel,
            target,
            errorMessage: "Exchange assertion failed. " + err.message
          });
        });
    }

    const q = await channel
      .assertQueue(options.queue.name, {
        durable: options.queue.durable,
        exclusive: options.queue.exclusive
      })
      .catch(err => {
        this.setAsClosed({
          channel,
          target,
          errorMessage: "Queue assertion failed. " + err.message
        });
        return null;
      });
    if (!q) return;

    if (options.exchange) {
      await channel
        .bindQueue(
          q.queue,
          options.exchange.name,
          options.exchange.pattern,
          options.exchange.headers
        )
        .catch(err => {
          this.setAsClosed({
            channel,
            target,
            errorMessage: "Queue binding failed. " + err.message
          });
        });
    }

    if (options.prefetch) {
      await channel.prefetch(options.prefetch).catch(err => {
        this.setAsClosed({
          channel,
          target,
          errorMessage: "Prefetch failed. " + err.message
        });
      });
    }

    await channel
      .consume(
        options.queue.name,
        (msg: amqp.Message | null) => this.onMessageHandler(target, msg, channel, options),
        {noAck: options.noAck}
      )
      .catch(err => {
        this.setAsClosed({
          channel,
          target,
          errorMessage: "Queue consumption failed. " + err.message
        });
      });
  }

  unsubscribe(target: event.Target): void {
    this.schedulerUnsubscription(target.id);

    this.subscriptions.forEach(s => {
      const isCwdEqual = s.target.cwd == target.cwd;
      const isHandlerEqual = s.target.handler == target.handler;
      const isMatchingTarget = target.handler ? isHandlerEqual && isCwdEqual : isCwdEqual;
      if (!isMatchingTarget) return;

      const getErrorMessage = (item: string, error) =>
        `Error on closing ${item} of the ${target.cwd}:${target.handler}, reason: ${JSON.stringify(error)}`;

      s.channel?.close().catch(err => console.error(getErrorMessage("channel", err)));
      s.connection?.close().catch(err => console.error(getErrorMessage("connection", err)));

      const index = this.subscriptions.findIndex(s => s.connection === s.connection);
      if (index !== -1) {
        this.subscriptions.splice(index, 1);
      }
    });
  }

  onEventsAreDrained(events: event.Event[]): Promise<any> {
    return Promise.resolve();
  }

  onMessageHandler(
    target: event.Target,
    msg: amqp.Message,
    channel: amqp.Channel,
    options: RabbitMQOptions
  ) {
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

    this.queue.enqueue(ev);
    this.rabbitmqQueue.enqueue(ev.id, message, channel, options);
  }

  onErrorHandler(target: event.Target, errorMessage: string) {
    const ev = new event.Event({
      id: uniqid(),
      type: event.Type.RABBITMQ,
      target
    });

    const message = new RabbitMQ.Message({
      errorMessage: Buffer.from(errorMessage)
    });

    this.queue.enqueue(ev);
    this.rabbitmqQueue.enqueue(ev.id, message);
  }

  setAsClosed({
    connection,
    channel,
    target,
    errorMessage
  }: {
    connection?: amqp.ChannelModel;
    channel?: amqp.Channel;
    target: event.Target;
    errorMessage: string;
  }) {
    const sub = connection
      ? this.subscriptions.find(s => s.connection === connection)
      : channel
        ? this.subscriptions.find(s => s.channel === channel)
        : null;

    if (sub) {
      this.onErrorHandler(target, errorMessage);
      sub.closed = true;
    }
  }
}

type Subscription = {
  target: event.Target;
  options: RabbitMQOptions;
  closed: boolean;
  connection?: amqp.ChannelModel;
  channel?: amqp.Channel;
};
