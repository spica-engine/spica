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
                  channel.bindQueue(q.queue, options.exchange.name, options.exchange.pattern);
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

            Object.defineProperty(channel, "target", {writable: false, value: target});
            this.channels.add(channel);
          })
          .catch(err => console.error(err));

        Object.defineProperty(connection, "target", {writable: false, value: target});
        this.connections.add(connection);
      })
      .catch(err => console.error(err));
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
          item.close();
          set.delete(item);
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
}
