import {EventQueue, HttpQueue} from "@spica-server/function/queue";
import {Http} from "@spica-server/function/queue/proto";
import {credentials} from "grpc";

describe("HttpQueue", () => {
  let queue: EventQueue;
  let httpQueue: HttpQueue;
  let httpQueueClient: any;

  beforeEach(() => {
    queue = new EventQueue(() => {});
    httpQueue = new HttpQueue();
    queue.addQueue(httpQueue);
    queue.listen();
    httpQueueClient = new Http.QueueClient("0.0.0.0:5678", credentials.createInsecure());
  });

  afterEach(() => {
    queue.kill();
    httpQueueClient.close();
  });

  it("should return error", done => {
    const pop = new Http.Request.Pop();
    pop.id = "1";
    httpQueueClient.pop(pop, (e, req) => {
      expect(e).not.toBeUndefined();
      expect(e.message).toBe("2 UNKNOWN: Queue has no item with id 1");
      expect(req).toBeUndefined();
      done();
    });
  });

  it("should not return error", done => {
    const pop = new Http.Request.Pop();
    pop.id = "2";
    httpQueue.enqueue(pop.id, new Http.Request(), undefined);
    httpQueueClient.pop(pop, (e, req) => {
      expect(e).toBe(null);
      expect(req instanceof Http.Request).toBe(true);
      done();
    });
  });
});
