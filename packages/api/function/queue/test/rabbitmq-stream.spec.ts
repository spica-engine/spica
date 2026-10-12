import {RabbitMQQueue, EventQueue} from "@spica-server/function-queue";
import {RabbitMQ} from "@spica-server/function-queue-proto";
import grpc, {credentials} from "@grpc/grpc-js";

process.env.FUNCTION_GRPC_ADDRESS = "0.0.0.0:5847";

describe("RabbitMQQueue stream settlement", () => {
  let queue: EventQueue;
  let rabbitmqQueue: RabbitMQQueue;
  let client: any;

  function fakeConsumer() {
    return {
      storeOffset: jest.fn().mockResolvedValue(undefined),
      queryOffset: jest.fn().mockResolvedValue(42n)
    };
  }

  function deliver(id: string, token: string, consumer: ReturnType<typeof fakeConsumer>) {
    rabbitmqQueue.enqueue(id, new RabbitMQ.Message({mode: "stream", consumer: token}), {
      token,
      consumer
    });
  }

  function storeOffset(consumer: string, offset: string) {
    return new Promise<{error: any}>(resolve => {
      client.storeOffset(new RabbitMQ.Message.StoreOffset({consumer, offset}), error =>
        resolve({error})
      );
    });
  }

  function queryOffset(consumer: string) {
    return new Promise<{error: any; result: RabbitMQ.Message.Offset}>(resolve => {
      client.queryOffset(new RabbitMQ.Message.QueryOffset({consumer}), (error, result) =>
        resolve({error, result})
      );
    });
  }

  beforeAll(() => {
    queue = new EventQueue(
      () => {},
      () => {},
      () => {},
      () => {}
    );
    rabbitmqQueue = new RabbitMQQueue();
    queue.addQueue(rabbitmqQueue);
    queue.listen();
    client = new RabbitMQ.QueueClient(
      process.env.FUNCTION_GRPC_ADDRESS,
      credentials.createInsecure()
    );
  });

  afterAll(() => {
    queue.kill();
    client.close();
  });

  it("should forward the offset to the consumer as a bigint", async () => {
    const consumer = fakeConsumer();
    deliver("1", "token", consumer);

    const {error} = await storeOffset("token", "9007199254740993");

    expect(error).toBe(null);
    expect(consumer.storeOffset).toHaveBeenCalledWith(9007199254740993n);
  });

  it("should return the stored offset as a string", async () => {
    const consumer = fakeConsumer();
    consumer.queryOffset.mockResolvedValue(9007199254740993n);
    deliver("1", "token", consumer);

    const {error, result} = await queryOffset("token");

    expect(error).toBe(null);
    expect(result.offset).toBe("9007199254740993");
  });

  it("should answer NOT_FOUND for an unknown token", async () => {
    const stored = await storeOffset("unknown", "1");
    const queried = await queryOffset("unknown");

    expect(stored.error.code).toBe(grpc.status.NOT_FOUND);
    expect(stored.error.details).toContain("unknown");
    expect(queried.error.code).toBe(grpc.status.NOT_FOUND);
  });

  it("should answer FAILED_PRECONDITION when the consumer rejects", async () => {
    const consumer = fakeConsumer();
    consumer.storeOffset.mockRejectedValue(new Error("offset store failed"));
    consumer.queryOffset.mockRejectedValue(new Error("no stored offset"));
    deliver("1", "token", consumer);

    const stored = await storeOffset("token", "1");
    const queried = await queryOffset("token");

    expect(stored.error.code).toBe(grpc.status.FAILED_PRECONDITION);
    expect(stored.error.details).toBe("offset store failed");
    expect(queried.error.code).toBe(grpc.status.FAILED_PRECONDITION);
    expect(queried.error.details).toBe("no stored offset");
  });

  it("should drop the token when its consumer is purged", async () => {
    const consumer = fakeConsumer();
    deliver("1", "token", consumer);

    rabbitmqQueue.purge(consumer);
    const {error} = await storeOffset("token", "1");

    expect(error.code).toBe(grpc.status.NOT_FOUND);
  });

  it("should keep the tokens of other consumers when one is purged", async () => {
    const first = fakeConsumer();
    const second = fakeConsumer();
    deliver("1", "first", first);
    deliver("2", "second", second);

    rabbitmqQueue.purge(first);
    const {error} = await storeOffset("second", "1");

    expect(error).toBe(null);
    expect(second.storeOffset).toHaveBeenCalled();
  });

  it("should not count deliveries as pending", () => {
    const consumer = fakeConsumer();
    deliver("1", "token", consumer);
    deliver("2", "token", consumer);

    expect(rabbitmqQueue.pendingDeliveries).toBe(0);
    expect(rabbitmqQueue.get("1")).toBeDefined();
    expect(rabbitmqQueue.get("2")).toBeDefined();
  });

  it("should point the token to the new consumer after a reconnect", async () => {
    const before = fakeConsumer();
    const after = fakeConsumer();
    deliver("1", "token", before);
    rabbitmqQueue.purge(before);
    deliver("2", "token", after);

    await storeOffset("token", "5");

    expect(before.storeOffset).not.toHaveBeenCalled();
    expect(after.storeOffset).toHaveBeenCalledWith(5n);
  });
});
