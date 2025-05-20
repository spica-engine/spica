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

  private connections = new Set<amqp.ChannelModel>();
  private channels = new Set<amqp.Channel>();

  constructor(
    private queue: EventQueue,
    private rabbitmqQueue: RabbitMQQueue,
    private schedulerUnsubscription: (targetId: string) => void
  ) {
    super();
  }

  subscribe(target: event.Target, options: RabbitMQOptions): void {
    amqp
      .connect(options.url)
      .then(connection => {
        connection.on("close", () => {
          if (this.connections.has(connection)) {
            this.onErrorHandler(target, "The connection was closed unexpectedly.");
          }
        });

        connection
          .createChannel()
          .then(channel => {
            channel.on("error", err => {
              this.onErrorHandler(target, "Channel error. " + err.message);
            });

            channel.on("close", () => {
              if (this.channels.has(channel)) {
                this.onErrorHandler(target, "The channel was closed unexpectedly.");
              }
            });

            if (options.exchange) {
              channel
                .assertExchange(options.exchange.name, options.exchange.type, {
                  durable: options.exchange.durable
                })
                .catch(err => {
                  this.onErrorHandler(target, "Exchange assertion failed. " + err.message);
                });
            }

            channel
              .assertQueue(options.queue.name, {
                durable: options.queue.durable,
                exclusive: options.queue.exclusive
              })
              .then(q => {
                if (options.exchange) {
                  channel.bindQueue(
                    q.queue,
                    options.exchange.name,
                    options.exchange.pattern,
                    options.exchange.headers
                  );
                }
              })
              .catch(err => {
                this.onErrorHandler(target, "Queue assertion failed. " + err.message);
              });

            if (options.prefetch) {
              channel.prefetch(options.prefetch);
            }

            channel
              .consume(
                options.queue.name,
                (msg: amqp.Message | null) => this.onMessageHandler(target, msg, channel, options),
                {
                  noAck: options.noAck
                }
              )
              .catch(err => {
                this.onErrorHandler(target, "Queue consumption failed. " + err.message);
              });

            Object.defineProperty(channel, "target", {writable: false, value: target});
            this.channels.add(channel);
          })
          .catch(err => {
            this.onErrorHandler(target, "Channel creation failed. " + err.message);
          });

        Object.defineProperty(connection, "target", {writable: false, value: target});
        this.connections.add(connection);
      })
      .catch(err => {
        this.onErrorHandler(target, "Connection failed. " + err.message);
      });
  }

  unsubscribe(target: event.Target): void {
    this.schedulerUnsubscription(target.id);

    const close = (set: Set<amqp.ChannelModel | amqp.Channel>) => {
      for (const item of set) {
        if (
          (!target.handler && item["target"].cwd == target.cwd) ||
          (target.handler &&
            item["target"].cwd == target.cwd &&
            item["target"].handler == target.handler)
        ) {
          set.delete(item);
          item
            .close()
            .catch(err =>
              console.error(
                `Error on closing connection/channel of the ${target.cwd}:${target.handler}, reason: ${JSON.stringify(err)}`
              )
            );
        }
      }
    };

    close(this.channels);
    close(this.connections);
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
}
