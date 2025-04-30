import {EventQueue, RabbitMQOptions, RabbitMQQueue} from "@spica-server/function/queue";
import {Description, Enqueuer} from "./enqueuer";
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
        connection
          .createChannel()
          .then(channel => {
            channel.on("error", err => {
              console.error("Channel error:", err.message);
            });

            if (options.exchange) {
              channel.assertExchange(options.exchange.name, options.exchange.type, {
                durable: options.exchange.durable
              });
            }

            channel
              .assertQueue(options.queue.name, {
                durable: options.queue.durable,
                exclusive: options.queue.exclusive
              })
              .then(q => {
                if (options.exchange) {
                  const pattern = options.exchange.pattern;
                  channel.bindQueue(q.queue, options.exchange.name, pattern);
                }
              });

            if (options.prefetch) {
              channel.prefetch(options.prefetch);
            }

            channel.consume(
              options.queue.name,
              (msg: amqp.Message | null) => this.onMessageHandler(target, msg, channel, options),
              {
                noAck: options.noAck
              }
            );
          })
          .catch(err => console.log(err));

        Object.defineProperty(connection, "target", {writable: false, value: target});

        this.connections.add(connection);
      })
      .catch(err => console.log(err));
  }

  unsubscribe(target: event.Target): void {
    this.schedulerUnsubscription(target.id);

    for (const connection of this.connections) {
      if (
        (!target.handler && connection["target"].cwd == target.cwd) ||
        (target.handler &&
          connection["target"].cwd == target.cwd &&
          connection["target"].handler == target.handler)
      ) {
        connection.close();
        this.connections.delete(connection);
      }
    }
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

    const message = new RabbitMQ.RabbitMQMessage({
      content: msg.content,
      fields: JSON.stringify(msg.fields),
      properties: JSON.stringify(msg.properties)
    });

    this.queue.enqueue(ev);
    this.rabbitmqQueue.enqueue(ev.id, message, channel, options);
  }
}
