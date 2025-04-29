import {Test} from "@nestjs/testing";
import {RabbitMQEnqueuer} from "@spica-server/function/enqueuer";
import {event} from "@spica-server/function/queue/proto";
import amqp from "amqplib/callback_api";

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

  const url = "amqp://localhost";

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
    rabbitmqEnqueuer.subscribe(noopTarget, {
      url,
      queue: {name: "queue1", durable: true},
      noAck: true
    });

    await new Promise(r => setTimeout(r, 100));

    const connections = rabbitmqEnqueuer["connections"];
    expect(connections.size).toEqual(1);

    const connection = Array.from(connections)[0];
    expect(connection["target"].cwd).toEqual("/tmp/fn1");
    expect(connection["target"].handler).toEqual("default");
  });

  it("should unsubscribe", async () => {
    const target1 = createTarget("/tmp/fn1", "handler1");
    const target2 = createTarget("/tmp/fn1", "handler2");
    const target3 = createTarget("/tmp/fn2", "handler1");

    rabbitmqEnqueuer.subscribe(target1, {url, queue: {name: "queue2", durable: true}, noAck: true});
    rabbitmqEnqueuer.subscribe(target2, {url, queue: {name: "queue2", durable: true}, noAck: true});
    rabbitmqEnqueuer.subscribe(target3, {url, queue: {name: "queue2", durable: true}, noAck: true});

    await new Promise(r => setTimeout(r, 100));

    const connections = rabbitmqEnqueuer["connections"];

    rabbitmqEnqueuer.unsubscribe(target1);
    await new Promise(r => setTimeout(r, 100));

    expect(connections.size).toEqual(2);

    const remainedConnections = Array.from(connections);
    const remainedItems = remainedConnections.map(conn => [
      conn["target"].cwd,
      conn["target"].handler
    ]);

    expect(remainedItems).toEqual(
      expect.arrayContaining([
        ["/tmp/fn1", "handler2"],
        ["/tmp/fn2", "handler1"]
      ])
    );
    expect(remainedItems.length).toBe(2);

    expect(schedulerUnsubscriptionSpy).toHaveBeenCalledWith(target1.id);
  });

  it("should enqueue events", async () => {
    rabbitmqEnqueuer.subscribe(noopTarget, {
      url,
      queue: {name: "queue3", durable: true},
      noAck: true
    });

    await new Promise(r => setTimeout(r, 100));

    amqp.connect(url, (error0, connection) => {
      connection.createChannel((error1, channel) => {
        var queue = "queue3";
        var msg = "Hello World!";

        channel.assertQueue(queue, {
          durable: true
        });

        channel.sendToQueue(queue, Buffer.from(msg), {
          persistent: true
        });
      });

      setTimeout(() => {
        connection.close();
        process.exit(0);
      }, 500);
    });

    await new Promise(r => setTimeout(r, 100));

    expect(eventQueue.enqueue).toHaveBeenCalledTimes(1);
    expect(rabbitmqQueue.enqueue).toHaveBeenCalledTimes(1);

    const message =
      rabbitmqQueue.enqueue.mock.calls[rabbitmqQueue.enqueue.mock.calls.length - 1][1];
    expect(message.msg).toBe("Hello World!");
  });
});
