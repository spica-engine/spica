import {RabbitMQEnqueuer} from "@spica-server/function-enqueuer";
import {event} from "@spica-server/function-queue-proto";
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
  let rabbitmqQueue: {enqueue: jest.Mock; purge: jest.Mock};
  let noopTarget: event.Target;
  let rabbitmqEnqueuer: RabbitMQEnqueuer;

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
      enqueue: jest.fn(),
      purge: jest.fn()
    };

    rabbitmqEnqueuer = new RabbitMQEnqueuer(eventQueue as any, rabbitmqQueue as any);
  });

  afterEach(async () => {
    await rabbitmqEnqueuer.onEventsAreDrained([]);
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
      const delivery1 =
        rabbitmqQueue.enqueue.mock.calls[rabbitmqQueue.enqueue.mock.calls.length - 2][2];

      const message2 =
        rabbitmqQueue.enqueue.mock.calls[rabbitmqQueue.enqueue.mock.calls.length - 1][1];

      expect(message1.content.toString()).toBe("Hello World!");
      expect(message2.content.toString()).toBe("Message");
      expect(delivery1).toBeUndefined();
    });

    it("should hand the channel and delivery tag over when acknowledgement is required", async () => {
      await rabbitmqEnqueuer.subscribe(noopTarget, {
        url,
        queue: {name: "queue-manual-ack", durable: true},
        noAck: false
      });

      connection = await amqp.connect(url);
      channel = await connection.createChannel();
      await channel.assertQueue("queue-manual-ack", {durable: true});
      channel.sendToQueue("queue-manual-ack", Buffer.from("Hello World!"));

      await delay(1000);

      expect(rabbitmqQueue.enqueue).toHaveBeenCalledTimes(1);
      const [, message, delivery] = rabbitmqQueue.enqueue.mock.calls[0];
      expect(message.content.toString()).toBe("Hello World!");
      expect(delivery.channel.connection).toBeDefined();
      expect(delivery.deliveryTag).toBe(JSON.parse(message.fields).deliveryTag);
    });

    it("should purge the deliveries of a channel when it is unsubscribed", async () => {
      await rabbitmqEnqueuer.subscribe(noopTarget, {
        url,
        queue: {name: "queue-purge", durable: true},
        noAck: false
      });

      connection = await amqp.connect(url);
      channel = await connection.createChannel();
      await channel.assertQueue("queue-purge", {durable: true});
      channel.sendToQueue("queue-purge", Buffer.from("Hello World!"));
      await delay(500);

      const {channel: consumerChannel} = rabbitmqQueue.enqueue.mock.calls[0][2];

      rabbitmqEnqueuer.unsubscribe(noopTarget);
      await delay(200);

      expect(rabbitmqQueue.purge).toHaveBeenCalledWith(consumerChannel);
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

  describe("resilience", () => {
    let connection: amqp.ChannelModel;
    let channel: amqp.Channel;

    beforeEach(async () => {
      rabbitmqEnqueuer = new RabbitMQEnqueuer(eventQueue as any, rabbitmqQueue as any, {
        initialDelayMs: 50,
        maxDelayMs: 200
      });
      connection = await amqp.connect(url);
      channel = await connection.createChannel();
    });

    afterEach(async () => {
      jest.restoreAllMocks();
      await connection.close();
    });

    function reportedErrors() {
      return rabbitmqQueue.enqueue.mock.calls
        .map(([, message]) => message)
        .filter(message => message.errorMessage?.length)
        .map(message => Buffer.from(message.errorMessage).toString());
    }

    async function consumerCount(queue: string) {
      return (await channel.checkQueue(queue)).consumerCount;
    }

    it("should keep retrying an unreachable broker but report the failure only once", async () => {
      const unreachable = "amqp://127.0.0.1:1";
      const connect = jest.spyOn(amqp, "connect");

      await rabbitmqEnqueuer.subscribe(noopTarget, {
        url: unreachable,
        queue: {name: "unreachable", durable: true},
        noAck: true
      });
      await delay(1000);

      const attempts = connect.mock.calls.filter(([target]) => target === unreachable);
      expect(attempts.length).toBeGreaterThan(3);
      expect(reportedErrors()).toHaveLength(1);
      expect(reportedErrors()[0]).toMatch(/^Connection failed\./);
    });

    it("should report a failed step once and not continue with a dead channel", async () => {
      await channel.assertExchange("conflicting-exchange", "direct", {durable: false});

      await rabbitmqEnqueuer.subscribe(noopTarget, {
        url,
        exchange: {name: "conflicting-exchange", type: "fanout", durable: false, pattern: ""},
        queue: {name: "", durable: false},
        noAck: true
      });
      await delay(800);

      expect(reportedErrors()).toHaveLength(1);
      expect(reportedErrors()[0]).toContain("inequivalent arg 'type'");
    });

    it("should consume again when the broker cancels the consumer", async () => {
      await rabbitmqEnqueuer.subscribe(noopTarget, {
        url,
        queue: {name: "cancelled-queue", durable: false},
        noAck: true
      });
      expect(await consumerCount("cancelled-queue")).toBe(1);

      await channel.deleteQueue("cancelled-queue");
      await delay(600);

      expect(reportedErrors()).toEqual(["The consumer was cancelled by the broker."]);
      expect(await consumerCount("cancelled-queue")).toBe(1);

      channel.sendToQueue("cancelled-queue", Buffer.from("after recovery"));
      await delay(300);

      const {calls} = rabbitmqQueue.enqueue.mock;
      expect(calls[calls.length - 1][1].content.toString()).toBe("after recovery");
    });

    it("should survive a connection error and reconnect", async () => {
      await rabbitmqEnqueuer.subscribe(noopTarget, {
        url,
        queue: {name: "connection-error-queue", durable: false},
        noAck: true
      });

      const [subscription] = rabbitmqEnqueuer["subscriptions"];
      subscription.connection.emit("error", new Error("boom"));
      await delay(600);

      expect(reportedErrors()).toEqual(["Connection error. boom"]);
      expect(await consumerCount("connection-error-queue")).toBe(1);
    });

    it("should close a connection that was established after unsubscribing", async () => {
      const connect = amqp.connect.bind(amqp);
      jest.spyOn(amqp, "connect").mockImplementation(async (target: any, options?: any) => {
        await delay(300);
        return connect(target, options);
      });

      const subscribing = rabbitmqEnqueuer.subscribe(noopTarget, {
        url,
        queue: {name: "late-connection-queue", durable: true},
        noAck: true
      });
      rabbitmqEnqueuer.unsubscribe(noopTarget);
      await subscribing;
      await delay(300);

      await channel.assertQueue("late-connection-queue", {durable: true});
      expect(await consumerCount("late-connection-queue")).toBe(0);
    });

    it("should close every subscription when the events are drained", async () => {
      await rabbitmqEnqueuer.subscribe(noopTarget, {
        url,
        queue: {name: "drained-queue", durable: false},
        noAck: true
      });
      expect(await consumerCount("drained-queue")).toBe(1);

      await rabbitmqEnqueuer.onEventsAreDrained([]);
      await delay(300);

      expect(rabbitmqEnqueuer["subscriptions"]).toHaveLength(0);
      expect(await consumerCount("drained-queue")).toBe(0);
    });
  });
});
