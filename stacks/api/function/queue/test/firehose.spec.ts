import {EventQueue, FirehoseQueue} from "@spica-server/function/queue";
import {Firehose} from "@spica-server/function/queue/proto";
import {credentials} from "grpc";

describe("FirehoseQueue", () => {
  let queue: EventQueue;
  let firehoseQueue: FirehoseQueue;
  let firehoseQueueClient: any;

  beforeEach(() => {
    queue = new EventQueue(() => {});
    firehoseQueue = new FirehoseQueue();
    queue.addQueue(firehoseQueue);
    queue.listen();
    firehoseQueueClient = new Firehose.QueueClient("0.0.0.0:5678", credentials.createInsecure());
  });

  afterEach(() => {
    queue.kill();
  });

  describe("pop", () => {
    it("should return error", done => {
      const pop = new Firehose.Message.Pop();
      pop.id = "1";
      firehoseQueueClient.pop(pop, (e, req) => {
        expect(e).not.toBeUndefined();
        expect(e.message).toBe("2 UNKNOWN: Queue has no item with id 1");
        expect(req).toBeUndefined();
        done();
      });
    });

    it("should not return error", done => {
      const pop = new Firehose.Message.Pop();
      pop.id = "2";

      firehoseQueue.enqueue(pop.id, new Firehose.Message.Incoming());

      firehoseQueueClient.pop(pop, (e, req) => {
        expect(e).toBe(null);
        expect(req instanceof Firehose.Message.Incoming).toBe(true);
        done();
      });
    });
  });
});
