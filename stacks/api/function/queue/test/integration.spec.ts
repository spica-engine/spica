import {EventQueue, HttpQueue} from "@spica-server/function/queue";
import {HttpQueueClient, HttpRequest} from "@spica-server/function/queue/proto";
import {credentials} from "grpc";

describe("HttpQueue", () => {
  let queue: EventQueue;
  let httpQueue: HttpQueue;
  let httpQueueClient: HttpQueueClient;

  beforeEach(() => {
    queue = new EventQueue();
    httpQueue = new HttpQueue();
    queue.addQueue(httpQueue);
    queue.listen();
    httpQueueClient = new HttpQueueClient("0.0.0.0:5678", credentials.createInsecure());
  });

  afterEach(() => {
    queue.kill();
    httpQueueClient.close();
  });

  it("should return error", done => {
    httpQueueClient.pop(new HttpRequest.Pop(), (e, req) => {
      expect(e).not.toBeUndefined();
      expect(e.message).toBe("2 UNKNOWN: Queue is empty.");
      expect(req).toBeUndefined();
      done();
    });
  });

  it("should not return error", done => {
    httpQueue.enqueue(new HttpRequest());
    httpQueueClient.pop(new HttpRequest.Pop(), (e, req) => {
      expect(e).toBe(null);
      expect(req instanceof HttpRequest).toBe(true);
      done();
    });
  });
});
