import {EventQueue, HttpQueue} from "@spica-server/function/queue";
import {Http} from "@spica-server/function/queue/proto";
import {credentials} from "@grpc/grpc-js";

describe("HttpQueue", () => {
  let queue: EventQueue;
  let httpQueue: HttpQueue;
  let httpQueueClient: any;

  beforeEach(() => {
    queue = new EventQueue(() => {}, () => {}, () => {}, () => {});
    httpQueue = new HttpQueue();
    queue.addQueue(httpQueue);
    queue.listen();
    httpQueueClient = new Http.QueueClient(
      process.env.FUNCTION_GRPC_ADDRESS,
      credentials.createInsecure()
    );
  });

  afterEach(() => {
    queue.kill();
    httpQueueClient.close();
  });

  it("should return error for nonexistent events", done => {
    const pop = new Http.Request.Pop();
    pop.id = "1";
    httpQueueClient.pop(pop, (e, req) => {
      expect(e).not.toBeUndefined();
      expect(e.message).toBe("1 CANCELLED: Unknown Error");
      expect(req).toBeUndefined();
      done();
    });
  });

  it("should pop", done => {
    const pop = new Http.Request.Pop();
    pop.id = "2";
    httpQueue.enqueue(pop.id, new Http.Request(), undefined);

    expect(httpQueue.size).toEqual(1);
    expect(httpQueue["streamMap"].size).toEqual(1);

    httpQueueClient.pop(pop, (e, req) => {
      expect(e).toBe(null);
      expect(req instanceof Http.Request).toBe(true);

      expect(httpQueue.size).toEqual(0);
      expect(httpQueue["streamMap"].size).toEqual(1);

      done();
    });
  });

  it("should dequeue when response ended", done => {
    const pop = new Http.Request.Pop();
    pop.id = "3";

    const response = {end: () => {}} as any;
    jest.spyOn(response, "end").mockImplementation(cb => cb());

    httpQueue.enqueue(pop.id, new Http.Request(), response);

    expect(httpQueue.size).toEqual(1);
    expect(httpQueue["streamMap"].size).toEqual(1);

    httpQueueClient.end(pop, () => {
      expect(httpQueue.size).toEqual(0);
      expect(httpQueue["streamMap"].size).toEqual(0);

      done();
    });
  });
});
