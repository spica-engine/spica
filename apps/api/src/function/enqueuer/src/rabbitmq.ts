import {EventQueue, RabbitMQOptions, RabbitMQQueue} from "@spica-server/function/queue";
import {Enqueuer} from "./enqueuer";
import {Description} from "@spica-server/interface/function/enqueuer";
import {event, RabbitMQ} from "@spica-server/function/queue/proto";
import amqp from "amqplib";
import uniqid from "uniqid";
import {ClassCommander, JobReducer} from "@spica-server/replication";
import {CommandType} from "@spica-server/interface/replication";

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
    private schedulerUnsubscription: (targetId: string) => void,
    private jobReducer?: JobReducer,
    private commander?: ClassCommander
  ) {
    super();
    if (this.commander) {
      this.commander = this.commander.new();
      this.commander.register(this, [this.shift], CommandType.SHIFT);
    }

    this.retryConnecting();
  }

  retryConnecting() {
    setInterval(() => {
      this.subscriptions.forEach(subscription => {
        if (!subscription.closed) return;

        this.unsubscribe(subscription.target);
        this.subscribe(subscription.target, subscription.options);
      });
    }, 60_000);
  }

  async subscribe(target: event.Target, options: RabbitMQOptions) {
    const subscription: Subscription = {target, options, closed: false};
    this.subscriptions.push(subscription);

    const connection = await amqp.connect(options.url).catch(err => {
      this.setAsClosed(subscription, target, "Connection failed. " + err.message);
      return null;
    });

    if (!connection) return;

    subscription.connection = connection;

    connection.on("close", () => {
      const isNotClosedByUs = this.subscriptions.some(
        subscription => subscription.connection == connection
      );
      if (isNotClosedByUs) {
        this.setAsClosed(subscription, target, "The connection was closed unexpectedly.");
      }
    });

    const channel = await connection.createChannel().catch(err => {
      this.setAsClosed(subscription, target, "Channel creation failed. " + err.message);
      return null;
    });
    if (!channel) return;

    subscription.channel = channel;

    channel.on("error", err => {
      this.setAsClosed(subscription, target, "Channel error. " + err.message);
    });

    channel.on("close", () => {
      const isNotClosedByUs = this.subscriptions.some(
        subscription => subscription.channel == channel
      );
      if (isNotClosedByUs) {
        this.setAsClosed(subscription, target, "The channel was closed unexpectedly.");
      }
    });

    if (options.exchange) {
      await channel
        .assertExchange(options.exchange.name, options.exchange.type, {
          durable: options.exchange.durable
        })
        .catch(err => {
          this.setAsClosed(subscription, target, "Exchange assertion failed. " + err.message);
        });
    }

    const q = await channel
      .assertQueue(options.queue.name, {
        durable: options.queue.durable,
        exclusive: options.queue.exclusive
      })
      .catch(err => {
        this.setAsClosed(subscription, target, "Queue assertion failed. " + err.message);
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
          this.setAsClosed(subscription, target, "Queue binding failed. " + err.message);
        });
    }

    if (options.prefetch) {
      await channel.prefetch(options.prefetch).catch(err => {
        this.setAsClosed(subscription, target, "Prefetch failed. " + err.message);
      });
    }

    await channel
      .consume(
        options.queue.name,
        (msg: amqp.Message | null) => this.onMessageHandler(target, msg, channel, options),
        {noAck: options.noAck}
      )
      .catch(err => {
        this.setAsClosed(subscription, target, "Queue consumption failed. " + err.message);
      });
  }

  unsubscribe(target: event.Target): void {
    this.schedulerUnsubscription(target.id);

    const indexesToRemove = [];

    this.subscriptions.forEach((subscription, index) => {
      const isCwdEqual = subscription.target.cwd == target.cwd;
      const isHandlerEqual = subscription.target.handler == target.handler;
      const isMatchingTarget = target.handler ? isHandlerEqual && isCwdEqual : isCwdEqual;
      if (!isMatchingTarget) return;

      const getErrorMessage = (item: string, error) =>
        `Error on closing ${item} of the ${target.cwd}:${target.handler}, reason: ${JSON.stringify(error)}`;

      subscription.channel?.close().catch(err => console.error(getErrorMessage("channel", err)));
      subscription.connection
        ?.close()
        .catch(err => console.error(getErrorMessage("connection", err)));

      indexesToRemove.push(index);
    });

    for (let i = indexesToRemove.length - 1; i >= 0; i--) {
      this.subscriptions.splice(indexesToRemove[i], 1);
    }
  }

  onEventsAreDrained(events: event.Event[]): Promise<any> {
    if (!this.jobReducer) {
      return;
    }

    const shiftPromises: Promise<any>[] = [];

    for (const event of events) {
      const shift = this.jobReducer.findOneAndDelete({event_id: event.id}).then(job => {
        if (!job) {
          console.error(`Job with event id ${event.id} does not exist!`);
          return;
        }

        return this.shift(job.msg, job.channel, event.target.toObject(), job.options, event.id);
      });

      shiftPromises.push(shift);
    }

    return Promise.all(shiftPromises);
  }

  onMessageHandler(
    target: event.Target,
    msg: amqp.Message,
    channel: amqp.Channel,
    options: RabbitMQOptions,
    eventId?: string
  ) {
    const ev = new event.Event({
      id: eventId || uniqid(),
      type: event.Type.RABBITMQ,
      target
    });

    const message = new RabbitMQ.Message({
      content: msg.content,
      fields: JSON.stringify(msg.fields),
      properties: JSON.stringify(msg.properties)
    });

    const enqueue = () => {
      this.queue.enqueue(ev);
      this.rabbitmqQueue.enqueue(ev.id, message, channel, options);
    };

    const meta = {
      _id: uniqid(),
      msg,
      channel,
      options
    };

    if (this.jobReducer) {
      this.jobReducer.do(meta, enqueue);
    } else {
      enqueue();
    }
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

  setAsClosed(subscription: Subscription, target: event.Target, errorMessage: string) {
    this.onErrorHandler(target, errorMessage);
    subscription.closed = true;
  }

  private shift(
    msg: amqp.Message,
    channel: amqp.Channel,
    target: {
      id: string;
      cwd: string;
      handler: string;
      context: {
        env: {
          key: string;
          value: string;
        }[];
        timeout: number;
      };
    },
    options: RabbitMQOptions,
    eventId: string
  ) {
    const newTarget = new event.Target({
      id: target.id,
      cwd: target.cwd,
      handler: target.handler,
      context: new event.SchedulingContext({
        env: Object.keys(target.context.env).reduce((envs, key) => {
          envs.push(
            new event.SchedulingContext.Env({
              key,
              value: target.context.env[key]
            })
          );
          return envs;
        }, []),
        timeout: target.context.timeout
      })
    });
    return this.onMessageHandler(newTarget, msg, channel, options, eventId);
  }
}

type Subscription = {
  target: event.Target;
  options: RabbitMQOptions;
  closed: boolean;
  connection?: amqp.ChannelModel;
  channel?: amqp.Channel;
};
