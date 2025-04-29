import {RabbitMQQueue, EventQueue} from "@spica-server/function/queue";
import {RabbitMQ} from "@spica-server/function/queue/proto";
import {credentials} from "@grpc/grpc-js";

process.env.FUNCTION_GRPC_ADDRESS = "0.0.0.0:5844";

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
      const pop = new RabbitMQ.RabbitMQMessage.Pop();
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
      const pop = new RabbitMQ.RabbitMQMessage.Pop();
      pop.id = "2";

      rabbitmqQueue.enqueue(pop.id, new RabbitMQ.RabbitMQMessage());
      expect(rabbitmqQueue.size).toEqual(1);

      rabbitmqQueueClient.pop(pop, (e, req) => {
        expect(e).toBe(null);
        expect(req instanceof RabbitMQ.RabbitMQMessage).toBe(true);

        expect(rabbitmqQueue.size).toEqual(0);

        done();
      });
    });
  });
});
