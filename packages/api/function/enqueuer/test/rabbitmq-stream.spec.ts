import {RabbitMQEnqueuer} from "@spica-server/function-enqueuer";
import {event} from "@spica-server/function-queue-proto";
import {Client, connect, Publisher} from "rabbitmq-stream-js-client";
import {GenericContainer} from "testcontainers";
import {mkdtempSync, writeFileSync} from "fs";
import {tmpdir} from "os";
import {join} from "path";
import uniqid from "uniqid";

async function delay(ms: number) {
  await new Promise(r => setTimeout(r, ms));
}

async function until(condition: () => boolean, timeout = 15_000) {
  const start = Date.now();
  while (!condition()) {
    if (Date.now() - start > timeout) {
      throw new Error("Condition was not met in time.");
    }
    await delay(50);
  }
}

function createTarget(handler = "default") {
  const target = new event.Target();
  target.cwd = "/tmp/fn1";
  target.handler = handler;
  return target;
}

describe("rabbitmq stream enqueuer", () => {
  let eventQueue: {enqueue: jest.Mock};
  let rabbitmqQueue: {enqueue: jest.Mock; purge: jest.Mock};
  let enqueuer: RabbitMQEnqueuer;

  let connection: {hostname: string; port: number; username: string; password: string} & Record<
    string,
    unknown
  >;
  let publishClient: Client;
  let publisher: Publisher;
  let stream: string;

  beforeAll(async () => {
    const credentials = {username: "guest", password: "guest"};
    if (process.env.RABBITMQ_STREAM_HOST) {
      connection = {
        hostname: process.env.RABBITMQ_STREAM_HOST,
        port: Number(process.env.RABBITMQ_STREAM_PORT) || 5552,
        ...credentials
      };
    } else {
      const plugins = join(mkdtempSync(join(tmpdir(), "spica-rabbitmq-")), "enabled_plugins");
      writeFileSync(plugins, "[rabbitmq_stream].\n");
      const container = await new GenericContainer("rabbitmq:4.1")
        .withExposedPorts(5552)
        .withCopyFilesToContainer([{source: plugins, target: "/etc/rabbitmq/enabled_plugins"}])
        .start();
      const mapped = container.getMappedPort(5552);
      connection = {
        hostname: "localhost",
        port: mapped,
        ...credentials,
        addressResolver: {enabled: true, endpoint: {host: "localhost", port: mapped}}
      };
    }
  }, 120_000);

  beforeEach(async () => {
    stream = `stream-${uniqid()}`;
    eventQueue = {enqueue: jest.fn()};
    rabbitmqQueue = {enqueue: jest.fn(), purge: jest.fn()};
    enqueuer = new RabbitMQEnqueuer(eventQueue as any, rabbitmqQueue as any, {
      initialDelayMs: 100,
      maxDelayMs: 200,
      stableAfterMs: 60_000
    });
    publishClient = await connect({vhost: "/", ...connection} as any);
  });

  afterEach(async () => {
    await enqueuer.onEventsAreDrained([]);
    await publisher?.close().catch(() => {});
    publisher = undefined;
    await publishClient.deleteStream({stream}).catch(() => {});
    await publishClient.close().catch(() => {});
  });

  async function createStream() {
    await publishClient.createStream({stream});
    publisher = await publishClient.declarePublisher({stream}, msg =>
      msg.applicationProperties?.region?.toString()
    );
  }

  async function publish(count: number, options: Record<string, unknown> = {}, from = 0) {
    for (let i = from; i < from + count; i++) {
      await publisher.send(Buffer.from(`message-${i}`), options);
    }
    await publisher.flush();
  }

  function subscribe(options: Record<string, unknown> = {}, target = createTarget()) {
    enqueuer.subscribe(target, {
      mode: "stream",
      connection: {...connection},
      stream: {name: stream},
      ...options
    } as any);
  }

  function deliveries() {
    return rabbitmqQueue.enqueue.mock.calls.filter(([, message]) => !message.errorMessage.length);
  }

  function contents() {
    return deliveries().map(([, message]) => message.content.toString());
  }

  function errors() {
    return rabbitmqQueue.enqueue.mock.calls
      .filter(([, message]) => message.errorMessage.length)
      .map(([, message]) => Buffer.from(message.errorMessage).toString());
  }

  async function streamExists() {
    const metadata = await publishClient.queryMetadata({streams: [stream]});
    return metadata.some(entry => entry.streamName === stream && entry.responseCode === 1);
  }

  describe("topology", () => {
    it("should create the stream", async () => {
      subscribe();

      await until(() => enqueuer["subscriptions"][0]?.consumer !== undefined);

      expect(await streamExists()).toBe(true);
      expect(errors()).toEqual([]);
    });

    it("should not create a passive stream and report the failure", async () => {
      subscribe({stream: {name: stream, passive: true}});

      await until(() => errors().length > 0);

      expect(errors()[0]).toContain("Consumer declaration failed.");
      expect(await streamExists()).toBe(false);
    });

    it("should consume a passive stream that exists", async () => {
      await createStream();
      await publish(1);

      subscribe({stream: {name: stream, passive: true}, consumer: {offset: {type: "first"}}});

      await until(() => deliveries().length === 1);
      expect(errors()).toEqual([]);
    });
  });

  describe("delivery", () => {
    it("should hand the message of the client over with the mode and the token", async () => {
      await createStream();
      await publish(1, {
        applicationProperties: {region: "eu", retries: 2},
        messageProperties: {contentType: "text/plain", messageId: "m-1"}
      });

      subscribe({consumer: {offset: {type: "first"}}});
      await until(() => deliveries().length === 1);

      const [, message, delivery] = deliveries()[0];
      const streamMessage = JSON.parse(message.stream);
      expect(message.content.toString()).toBe("message-0");
      expect(message.mode).toBe("stream");
      expect(message.consumer).toBeTruthy();
      expect(streamMessage.offset).toEqual({type: "BigInt", value: "0"});
      expect(streamMessage.applicationProperties).toEqual({region: "eu", retries: 2});
      expect(streamMessage.messageProperties).toMatchObject({
        contentType: "text/plain",
        messageId: "m-1"
      });
      expect(streamMessage.content).toBeUndefined();
      expect(delivery.token).toBe(message.consumer);
      expect(delivery.consumer).toBe(enqueuer["subscriptions"][0].consumer);
      expect(eventQueue.enqueue).toHaveBeenCalledTimes(1);
    });

    it("should keep the same token for every message of a subscription", async () => {
      await createStream();
      await publish(3);

      subscribe({consumer: {offset: {type: "first"}}});
      await until(() => deliveries().length === 3);

      expect(new Set(deliveries().map(([, message]) => message.consumer)).size).toBe(1);
    });
  });

  describe("offsets", () => {
    it("should start from the first message", async () => {
      await createStream();
      await publish(3);

      subscribe({consumer: {offset: {type: "first"}}});

      await until(() => deliveries().length === 3);
      expect(contents()).toEqual(["message-0", "message-1", "message-2"]);
    });

    it("should start after the last message by default", async () => {
      await createStream();
      await publish(2);

      subscribe();
      await until(() => enqueuer["subscriptions"][0]?.consumer !== undefined);
      await publish(1, {}, 2);

      await until(() => deliveries().length === 1);
      expect(contents()).toEqual(["message-2"]);
    });

    it("should start from the last chunk", async () => {
      await createStream();
      await publish(2);

      subscribe({consumer: {offset: {type: "last"}}});

      await until(() => deliveries().length > 0);
      expect(contents().at(-1)).toBe("message-1");
    });

    it("should start from the given offset", async () => {
      await createStream();
      await publish(5);

      subscribe({consumer: {offset: {type: "offset", value: 3}}});

      await until(() => deliveries().length === 2);
      expect(contents()).toEqual(["message-3", "message-4"]);
    });

    it("should start from a timestamp", async () => {
      await createStream();
      await publish(2);
      await delay(1500);
      const cutoff = Date.now();
      await delay(1500);
      await publish(2, {}, 2);

      subscribe({consumer: {offset: {type: "timestamp", value: cutoff}}});

      await until(() => deliveries().length === 2);
      expect(contents()).toEqual(["message-2", "message-3"]);
    });
  });

  describe("filter", () => {
    it("should receive the messages of the filter values only", async () => {
      await createStream();
      await publish(2, {applicationProperties: {region: "eu"}});
      await publish(2, {applicationProperties: {region: "us"}}, 2);

      subscribe({
        consumer: {
          offset: {type: "first"},
          filter: {values: ["us"], matchUnfiltered: false}
        }
      });

      await until(() => contents().includes("message-3"));
      const regions = deliveries().map(
        ([, message]) => JSON.parse(message.stream).applicationProperties.region
      );
      expect(regions).toContain("us");
      expect(contents()).toEqual(expect.arrayContaining(["message-2", "message-3"]));
    });
  });

  describe("single active consumer", () => {
    it("should deliver to one subscription only", async () => {
      await createStream();

      const first = createTarget("first");
      const second = createTarget("second");
      const consumer = {offset: {type: "first"}, consumerRef: "projector", singleActive: true};
      subscribe({consumer}, first);
      subscribe({consumer}, second);
      await until(() => enqueuer["subscriptions"].every(s => s.consumer !== undefined));

      await publish(3);
      await until(() => deliveries().length >= 3);
      await delay(500);

      expect(deliveries().length).toBe(3);
      const tokens = new Set(deliveries().map(([, message]) => message.consumer));
      expect(tokens.size).toBe(1);
    });
  });

  describe("offset tracking", () => {
    it("should continue after the stored offset on a fresh subscribe", async () => {
      await createStream();
      await publish(5);

      subscribe({consumer: {offset: {type: "first"}, consumerRef: "projector"}});
      await until(() => deliveries().length === 5);
      const consumer = enqueuer["subscriptions"][0].consumer;
      await consumer.storeOffset(2n);
      await delay(500);
      enqueuer.unsubscribe(createTarget());
      rabbitmqQueue.enqueue.mockClear();

      subscribe({consumer: {offset: {type: "first"}, consumerRef: "projector"}});

      await until(() => deliveries().length === 2);
      expect(contents()).toEqual(["message-3", "message-4"]);
    });

    it("should use the configured offset when nothing is stored", async () => {
      await createStream();
      await publish(2);

      subscribe({consumer: {offset: {type: "first"}, consumerRef: "unseen"}});

      await until(() => deliveries().length === 2);
      expect(contents()).toEqual(["message-0", "message-1"]);
    });
  });

  describe("resilience", () => {
    const loseConnection = async () => {
      const lost = enqueuer["subscriptions"][0].client;
      (enqueuer["subscriptions"][0].consumer as any).connection.socket.destroy();

      await until(() => errors().length > 0);
      await until(
        () =>
          enqueuer["subscriptions"][0].consumer !== undefined &&
          enqueuer["subscriptions"][0].client !== lost
      );
    };

    it("should restart from the configured offset after the connection is lost", async () => {
      await createStream();
      await publish(3);

      subscribe({consumer: {offset: {type: "first"}}});
      await until(() => deliveries().length === 3);

      await loseConnection();
      await publish(2, {}, 3);

      await until(() => deliveries().length === 8);
      expect(contents()).toEqual([0, 1, 2, 0, 1, 2, 3, 4].map(i => `message-${i}`));
      expect(errors()[0]).toContain("closed unexpectedly");
    });

    it("should continue after the stored offset when the connection is lost", async () => {
      await createStream();
      await publish(3);

      subscribe({consumer: {offset: {type: "first"}, consumerRef: "projector"}});
      await until(() => deliveries().length === 3);
      await enqueuer["subscriptions"][0].consumer.storeOffset(1n);
      await delay(500);

      await loseConnection();

      await until(() => deliveries().length === 4);
      await delay(500);
      expect(contents()).toEqual(["message-0", "message-1", "message-2", "message-2"]);
    });

    it("should keep retrying while the broker is unreachable and report each attempt", async () => {
      enqueuer.subscribe(createTarget(), {
        mode: "stream",
        connection: {...connection, hostname: "127.0.0.1", port: 1, addressResolver: undefined},
        stream: {name: stream}
      } as any);

      await until(() => errors().length >= 2);

      expect(errors().every(error => error.startsWith("Connection failed."))).toBe(true);
    });
  });

  describe("teardown", () => {
    it("should close the consumer and the client and purge the token on unsubscribe", async () => {
      await createStream();
      subscribe();
      await until(() => enqueuer["subscriptions"][0]?.consumer !== undefined);
      const {client, consumer} = enqueuer["subscriptions"][0];

      enqueuer.unsubscribe(createTarget());

      expect(rabbitmqQueue.purge).toHaveBeenCalledWith(consumer);
      expect(enqueuer["subscriptions"]).toEqual([]);
      await until(() => client.consumerCounts() === 0);
    });

    it("should release every subscription when the events are drained", async () => {
      await createStream();
      subscribe();
      await until(() => enqueuer["subscriptions"][0]?.consumer !== undefined);
      const {consumer} = enqueuer["subscriptions"][0];

      await enqueuer.onEventsAreDrained([]);

      expect(rabbitmqQueue.purge).toHaveBeenCalledWith(consumer);
      expect(enqueuer["subscriptions"]).toEqual([]);
    });

    it("should not delete the stream", async () => {
      await createStream();
      subscribe();
      await until(() => enqueuer["subscriptions"][0]?.consumer !== undefined);

      enqueuer.unsubscribe(createTarget());
      await delay(500);

      expect(await streamExists()).toBe(true);
    });
  });
});
