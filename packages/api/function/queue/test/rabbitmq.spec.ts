import {RabbitMQQueue, EventQueue} from "@spica-server/function-queue";
import {RabbitMQ} from "@spica-server/function-queue-proto";
import grpc, {credentials} from "@grpc/grpc-js";

process.env.FUNCTION_GRPC_ADDRESS = "0.0.0.0:5846";

describe("RabbitMQQueue", () => {
  let queue: EventQueue;
  let rabbitmqQueue: RabbitMQQueue;
  let rabbitmqQueueClient: any;

  beforeEach(() => {
    queue = new EventQueue(
      () => {},
      () => {},
      () => {},
      () => {}
    );
    rabbitmqQueue = new RabbitMQQueue();
    queue.addQueue(rabbitmqQueue);
    queue.listen();
    rabbitmqQueueClient = new RabbitMQ.QueueClient(
      process.env.FUNCTION_GRPC_ADDRESS,
      credentials.createInsecure()
    );
  });

  afterEach(() => {
    queue.kill();
    rabbitmqQueueClient.close();
  });

  describe("pop", () => {
    it("should return error for nonexistent events", done => {
      const pop = new RabbitMQ.Message.Pop();
      pop.id = "1";
      rabbitmqQueueClient.pop(pop, (e, req) => {
        expect(e).not.toBeUndefined();
        expect(e.message).toBe("2 UNKNOWN: Queue has no item with id 1");
        expect(req).toBeUndefined();

        expect(rabbitmqQueue.size).toEqual(0);

        done();
      });
    });

    it("should pop", done => {
      const pop = new RabbitMQ.Message.Pop();
      pop.id = "2";

      rabbitmqQueue.enqueue(pop.id, new RabbitMQ.Message());
      expect(rabbitmqQueue.size).toEqual(1);

      rabbitmqQueueClient.pop(pop, (e, req) => {
        expect(e).toBe(null);
        expect(req instanceof RabbitMQ.Message).toBe(true);

        expect(rabbitmqQueue.size).toEqual(0);

        done();
      });
    });
  });

  describe("settle", () => {
    type Method = "ack" | "nack" | "reject" | "ackAll" | "nackAll";

    function fakeChannel() {
      return {
        ack: jest.fn(),
        nack: jest.fn(),
        reject: jest.fn(),
        ackAll: jest.fn(),
        nackAll: jest.fn()
      };
    }

    function deliver(id: string, channel: ReturnType<typeof fakeChannel>, deliveryTag: number) {
      rabbitmqQueue.enqueue(id, new RabbitMQ.Message(), {channel: channel as any, deliveryTag});
    }

    function settle(
      method: Method,
      settlement: {id: string; allUpTo?: boolean; requeue?: boolean}
    ) {
      return new Promise<{error: any}>(resolve => {
        rabbitmqQueueClient[method](new RabbitMQ.Message.Settle(settlement), error =>
          resolve({error})
        );
      });
    }

    it("should ack and stop tracking the delivery", async () => {
      const channel = fakeChannel();
      deliver("1", channel, 7);

      const {error} = await settle("ack", {id: "1"});

      expect(error).toBe(null);
      expect(channel.ack).toHaveBeenCalledWith({fields: {deliveryTag: 7}}, false);
      expect(rabbitmqQueue.pendingDeliveries).toBe(0);
    });

    it("should refuse to settle the same delivery twice", async () => {
      const channel = fakeChannel();
      deliver("1", channel, 7);

      await settle("ack", {id: "1"});
      const {error} = await settle("nack", {id: "1", requeue: true});

      expect(error.code).toBe(grpc.status.NOT_FOUND);
      expect(channel.ack).toHaveBeenCalledTimes(1);
      expect(channel.nack).not.toHaveBeenCalled();
    });

    it("should refuse to settle a message that was consumed with noAck", async () => {
      rabbitmqQueue.enqueue("1", new RabbitMQ.Message());

      const {error} = await settle("ack", {id: "1"});

      expect(error.code).toBe(grpc.status.NOT_FOUND);
    });

    it("should fail for unknown events", async () => {
      const {error} = await settle("ack", {id: "unknown"});

      expect(error.code).toBe(grpc.status.NOT_FOUND);
      expect(error.details).toContain("unknown");
    });

    it("should pass the requested flags to amqplib", async () => {
      const channel = fakeChannel();
      deliver("1", channel, 1);
      deliver("2", channel, 2);
      deliver("3", channel, 3);

      await settle("nack", {id: "1", allUpTo: false, requeue: true});
      await settle("reject", {id: "2", requeue: false});
      await settle("nack", {id: "3", allUpTo: true, requeue: false});

      expect(channel.nack).toHaveBeenNthCalledWith(1, {fields: {deliveryTag: 1}}, false, true);
      expect(channel.reject).toHaveBeenCalledWith({fields: {deliveryTag: 2}}, false);
      expect(channel.nack).toHaveBeenNthCalledWith(2, {fields: {deliveryTag: 3}}, true, false);
    });

    it("should stop tracking every earlier delivery of the channel on allUpTo", async () => {
      const channel = fakeChannel();
      const otherChannel = fakeChannel();
      deliver("1", channel, 1);
      deliver("2", channel, 2);
      deliver("3", channel, 3);
      deliver("other", otherChannel, 1);

      await settle("ack", {id: "2", allUpTo: true});

      expect(channel.ack).toHaveBeenCalledWith({fields: {deliveryTag: 2}}, true);
      expect(rabbitmqQueue.pendingDeliveries).toBe(2);
      expect((await settle("ack", {id: "1"})).error.code).toBe(grpc.status.NOT_FOUND);
      expect((await settle("ack", {id: "3"})).error).toBe(null);
      expect((await settle("ack", {id: "other"})).error).toBe(null);
    });

    it("should stop tracking every delivery of the channel on ackAll and nackAll", async () => {
      const channel = fakeChannel();
      const otherChannel = fakeChannel();
      deliver("1", channel, 1);
      deliver("2", channel, 2);
      deliver("other", otherChannel, 1);

      await settle("ackAll", {id: "1"});
      expect(channel.ackAll).toHaveBeenCalledTimes(1);
      expect(rabbitmqQueue.pendingDeliveries).toBe(1);

      await settle("nackAll", {id: "other", requeue: false});
      expect(otherChannel.nackAll).toHaveBeenCalledWith(false);
      expect(rabbitmqQueue.pendingDeliveries).toBe(0);
    });

    it("should report amqplib failures and keep the delivery", async () => {
      const channel = fakeChannel();
      channel.ack.mockImplementation(() => {
        throw new Error("Channel closed");
      });
      deliver("1", channel, 1);

      const {error} = await settle("ack", {id: "1"});

      expect(error.code).toBe(grpc.status.FAILED_PRECONDITION);
      expect(error.details).toBe("Channel closed");
      expect(rabbitmqQueue.pendingDeliveries).toBe(1);
    });

    it("should stop tracking the deliveries of a purged channel", async () => {
      const channel = fakeChannel();
      const otherChannel = fakeChannel();
      deliver("1", channel, 1);
      deliver("2", otherChannel, 1);

      rabbitmqQueue.purge(channel as any);

      expect(rabbitmqQueue.pendingDeliveries).toBe(1);
      expect((await settle("ack", {id: "1"})).error.code).toBe(grpc.status.NOT_FOUND);
    });
  });
});
