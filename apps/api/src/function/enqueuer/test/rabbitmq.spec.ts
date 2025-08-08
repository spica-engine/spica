import {RabbitMQEnqueuer} from "..";
import {event} from "../../queue/proto";
import amqp from "amqplib";
import {GenericContainer} from "testcontainers";

async function delay(ms: number) {
  await new Promise(r => setTimeout(r, ms));
}

function createTarget(cwd?: string, handler?: string) {
  const target = new event.Target();
  target.cwd = cwd || "/tmp/fn1";
  target.handler = handler || "default";
  return target;
}

describe("rabbitmq enqueuer", () => {
  let eventQueue: {enqueue: jest.Mock};
  let rabbitmqQueue: {enqueue: jest.Mock};
  let noopTarget: event.Target;
  let rabbitmqEnqueuer: RabbitMQEnqueuer;

  let schedulerUnsubscriptionSpy: jest.Mock;

  let url: string;

  beforeAll(async () => {
    const rabbitMqUrl = process.env.RABBITMQ_URL;
    if (rabbitMqUrl) {
      console.info("Connecting already running RabbitMQ server..");
      url = rabbitMqUrl;
    } else {
      console.info("Creating and connecting RabbitMQ server..");
      try {
        const container = await new GenericContainer("rabbitmq:4.1").withExposedPorts(5672).start();
        url = `amqp://localhost:${container.getMappedPort(5672)}`;
      } catch (e) {
        console.error(e);
      }
    }
  });

  beforeEach(async () => {
    noopTarget = createTarget();

    eventQueue = {
      enqueue: jest.fn()
    };
    rabbitmqQueue = {
      enqueue: jest.fn()
    };

    schedulerUnsubscriptionSpy = jest.fn();

    rabbitmqEnqueuer = new RabbitMQEnqueuer(
      eventQueue as any,
      rabbitmqQueue as any,
      schedulerUnsubscriptionSpy
    );
  });

  it("should subscribe", async () => {
    await rabbitmqEnqueuer.subscribe(noopTarget, {
      url,
      queue: {name: "queue1", durable: true},
      noAck: true
    });

    await delay(1000);

    const subscriptions = rabbitmqEnqueuer["subscriptions"];
    expect(subscriptions.length).toEqual(1);

    const {target} = subscriptions[0];
    expect(target.cwd).toEqual("/tmp/fn1");
    expect(target.handler).toEqual("default");
  });

  it("should unsubscribe", async () => {
    const target1 = createTarget("/tmp/fn1", "handler1");
    const target2 = createTarget("/tmp/fn1", "handler2");
    const target3 = createTarget("/tmp/fn2", "handler1");

    await Promise.all([
      rabbitmqEnqueuer.subscribe(target1, {
        url,
        queue: {name: "queue2", durable: true},
        noAck: true
      }),
      rabbitmqEnqueuer.subscribe(target2, {
        url,
        queue: {name: "queue2", durable: true},
        noAck: true
      }),
      rabbitmqEnqueuer.subscribe(target3, {
        url,
        queue: {name: "queue2", durable: true},
        noAck: true
      })
    ]);

    await delay(1000);

    const subscriptions = rabbitmqEnqueuer["subscriptions"];

    rabbitmqEnqueuer.unsubscribe(target1);
    await delay(1000);

    expect(subscriptions.length).toEqual(2);

    const remainedItems = subscriptions.map(conn => [conn["target"].cwd, conn["target"].handler]);

    expect(remainedItems).toEqual(
      expect.arrayContaining([
        ["/tmp/fn1", "handler2"],
        ["/tmp/fn2", "handler1"]
      ])
    );
    expect(remainedItems.length).toBe(2);

    expect(schedulerUnsubscriptionSpy).toHaveBeenCalledWith(target1.id);
  });

  describe("enqueue events", () => {
    let channel: amqp.Channel;
    let connection: amqp.ChannelModel;

    afterEach(() => {
      channel.close();
      connection.close();
    });

    it("should enqueue with queue name", async () => {
      await rabbitmqEnqueuer.subscribe(noopTarget, {
        url,
        queue: {name: "queue3", durable: true},
        noAck: true
      });

      connection = await amqp.connect(url);
      channel = await connection.createChannel();

      const queue = "queue3";

      await channel.assertQueue(queue, {
        durable: true
      });

      const msg1 = "Hello World!";
      const msg2 = "Message";
      channel.sendToQueue(queue, Buffer.from(msg1));
      channel.sendToQueue(queue, Buffer.from(msg2));

      await delay(1000);

      expect(eventQueue.enqueue).toHaveBeenCalledTimes(2);
      expect(rabbitmqQueue.enqueue).toHaveBeenCalledTimes(2);

      const message1 =
        rabbitmqQueue.enqueue.mock.calls[rabbitmqQueue.enqueue.mock.calls.length - 2][1];
      const messageChannel =
        rabbitmqQueue.enqueue.mock.calls[rabbitmqQueue.enqueue.mock.calls.length - 2][2];

      const message2 =
        rabbitmqQueue.enqueue.mock.calls[rabbitmqQueue.enqueue.mock.calls.length - 1][1];

      expect(message1.content.toString()).toBe("Hello World!");
      expect(message2.content.toString()).toBe("Message");
      expect(messageChannel.connection).toBeDefined();
      expect(messageChannel.ack).toBeDefined();
      expect(messageChannel.nack).toBeDefined();
    });

    it("should enqueue for fanout type exchange", async () => {
      await rabbitmqEnqueuer.subscribe(noopTarget, {
        url,
        exchange: {name: "fanoutExchange", type: "fanout", durable: true, pattern: ""},
        queue: {name: "", durable: true},
        noAck: true
      });

      await delay(1000);

      connection = await amqp.connect(url);
      channel = await connection.createChannel();

      const exchange = "fanoutExchange";
      await channel.assertExchange(exchange, "fanout", {
        durable: true
      });

      const msg = "Hello World!";
      channel.publish(exchange, "", Buffer.from(msg));

      const anotherExchange = "AnotherExchange";
      await channel.assertExchange(anotherExchange, "fanout", {
        durable: true
      });

      const anotherMsg = "Another message";
      channel.publish(anotherExchange, "", Buffer.from(anotherMsg));

      await delay(1000);

      expect(eventQueue.enqueue).toHaveBeenCalledTimes(1);
      expect(rabbitmqQueue.enqueue).toHaveBeenCalledTimes(1);

      const message =
        rabbitmqQueue.enqueue.mock.calls[rabbitmqQueue.enqueue.mock.calls.length - 1][1];

      const anotherMessageCall =
        rabbitmqQueue.enqueue.mock.calls[rabbitmqQueue.enqueue.mock.calls.length - 2];

      expect(message.content.toString()).toBe("Hello World!");
      expect(anotherMessageCall).toBeUndefined();
    });

    it("should enqueue for direct type exchange", async () => {
      const severity = "info";

      await rabbitmqEnqueuer.subscribe(noopTarget, {
        url,
        exchange: {name: "directExchange", type: "direct", durable: true, pattern: severity},
        queue: {name: "", durable: true},
        noAck: true
      });

      await delay(1000);

      connection = await amqp.connect(url);
      channel = await connection.createChannel();

      const exchange = "directExchange";

      await channel.assertExchange(exchange, "direct", {
        durable: true
      });

      const msg = "Message with severity info";
      channel.publish(exchange, severity, Buffer.from(msg));

      const errorMsg = "Message with severity error";
      channel.publish(exchange, "error", Buffer.from(errorMsg));

      await delay(1000);

      expect(eventQueue.enqueue).toHaveBeenCalledTimes(1);
      expect(rabbitmqQueue.enqueue).toHaveBeenCalledTimes(1);

      const message =
        rabbitmqQueue.enqueue.mock.calls[rabbitmqQueue.enqueue.mock.calls.length - 1][1];

      const errorMessageCall =
        rabbitmqQueue.enqueue.mock.calls[rabbitmqQueue.enqueue.mock.calls.length - 2];

      expect(message.content.toString()).toBe("Message with severity info");
      expect(errorMessageCall).toBeUndefined();
    });

    it("should enqueue for topic type exchange", async () => {
      await rabbitmqEnqueuer.subscribe(noopTarget, {
        url,
        exchange: {name: "topicExchange", type: "topic", durable: false, pattern: "*.critical"},
        queue: {name: "", durable: false},
        noAck: true
      });

      await delay(1000);

      connection = await amqp.connect(url);
      channel = await connection.createChannel();

      const exchange = "topicExchange";

      await channel.assertExchange(exchange, "topic", {
        durable: false
      });

      const criticalMsg = "Critical message";
      channel.publish(exchange, "message.critical", Buffer.from(criticalMsg));

      const generalMsg = "General message";
      channel.publish(exchange, "message.general", Buffer.from(generalMsg));

      await delay(1000);

      expect(eventQueue.enqueue).toHaveBeenCalledTimes(1);
      expect(rabbitmqQueue.enqueue).toHaveBeenCalledTimes(1);

      const criticalMessage =
        rabbitmqQueue.enqueue.mock.calls[rabbitmqQueue.enqueue.mock.calls.length - 1][1];

      const generalMessageCall =
        rabbitmqQueue.enqueue.mock.calls[rabbitmqQueue.enqueue.mock.calls.length - 2];

      expect(criticalMessage.content.toString()).toBe("Critical message");
      expect(generalMessageCall).toBeUndefined();
    });

    it("should enqueue for headers type exchange", async () => {
      await rabbitmqEnqueuer.subscribe(noopTarget, {
        url,
        exchange: {
          name: "headersExchange",
          type: "headers",
          durable: false,
          pattern: "",
          headers: {
            "x-match": "all",
            type: "report",
            format: "pdf"
          }
        },
        queue: {name: "", durable: false},
        noAck: true
      });

      await delay(1000);

      connection = await amqp.connect(url);
      channel = await connection.createChannel();

      const exchange = "headersExchange";

      await channel.assertExchange(exchange, "headers", {
        durable: false
      });

      const pdfMsg = "Messsage with pdf format";
      channel.publish(exchange, "", Buffer.from(pdfMsg), {
        headers: {
          "x-match": "all",
          type: "report",
          format: "pdf"
        }
      });

      const jpgMsg = "Messsage with jpg format";
      channel.publish(exchange, "message.general", Buffer.from(jpgMsg), {
        headers: {
          "x-match": "all",
          type: "report",
          format: "jpg"
        }
      });

      await delay(1000);

      expect(eventQueue.enqueue).toHaveBeenCalledTimes(1);
      expect(rabbitmqQueue.enqueue).toHaveBeenCalledTimes(1);

      const pdfMessage =
        rabbitmqQueue.enqueue.mock.calls[rabbitmqQueue.enqueue.mock.calls.length - 1][1];

      const jpgMessageCall =
        rabbitmqQueue.enqueue.mock.calls[rabbitmqQueue.enqueue.mock.calls.length - 2];

      expect(pdfMessage.content.toString()).toBe("Messsage with pdf format");
      expect(jpgMessageCall).toBeUndefined();
    });
  });
});
