import {EventQueue, GrpcQueue} from "@spica-server/function/queue";
import {Grpc} from "@spica-server/function/queue/proto";
import {credentials} from "@grpc/grpc-js";

process.env.FUNCTION_GRPC_ADDRESS = "0.0.0.0:5850";

describe("GrpcQueue", () => {
  let queue: EventQueue;
  let grpcQueue: GrpcQueue;
  let grpcQueueClient: any;

  beforeEach(() => {
    queue = new EventQueue(
      () => {},
      () => {},
      () => {},
      () => {}
    );
    grpcQueue = new GrpcQueue();
    queue.addQueue(grpcQueue);
    queue.listen();
    grpcQueueClient = new Grpc.QueueClient(
      process.env.FUNCTION_GRPC_ADDRESS,
      credentials.createInsecure()
    );
  });

  afterEach(() => {
    queue.kill();
    grpcQueueClient.close();
  });

  it("should return error for nonexistent events", done => {
    const pop = new Grpc.Request.Pop();
    pop.id = "1";
    grpcQueueClient.pop(pop, (e, req) => {
      expect(e).not.toBeUndefined();
      expect(e.message).toContain("Queue has no item with id 1");
      expect(req).toBeUndefined();
      done();
    });
  });

  it("should pop request", done => {
    const pop = new Grpc.Request.Pop();
    pop.id = "2";

    const request = new Grpc.Request({
      id: "2",
      service: "TestService",
      method: "TestMethod",
      payload: Buffer.from(JSON.stringify({test: "data"}))
    });

    const mockCall = {
      sendMetadata: jest.fn(),
      sendMessage: jest.fn(),
      end: jest.fn(),
      cancelled: false
    };

    grpcQueue.enqueue(pop.id, request, mockCall);

    expect(grpcQueue.size).toEqual(1);

    grpcQueueClient.pop(pop, (e, req) => {
      expect(e).toBe(null);
      expect(req instanceof Grpc.Request).toBe(true);
      expect(req.id).toBe("2");
      expect(req.service).toBe("TestService");
      expect(req.method).toBe("TestMethod");

      expect(grpcQueue.size).toEqual(0);

      done();
    });
  });

  it("should send response", done => {
    const eventId = "3";

    const mockCall = {
      sendMetadata: jest.fn(),
      sendMessage: jest.fn(),
      end: jest.fn(),
      cancelled: false
    };

    grpcQueue.enqueue(eventId, new Grpc.Request({id: eventId}), mockCall);

    const response = new Grpc.Response({
      id: eventId,
      status: 0,
      data: Buffer.from(JSON.stringify({result: "success"}))
    });

    grpcQueueClient.sendResponse(response, (e, result) => {
      expect(e).toBe(null);
      expect(mockCall.sendMessage).toHaveBeenCalled();
      expect(mockCall.end).toHaveBeenCalled();
      expect(grpcQueue.size).toEqual(0);
      done();
    });
  });

  it("should send error", done => {
    const eventId = "4";

    const mockCall = {
      sendMetadata: jest.fn(),
      sendMessage: jest.fn(),
      end: jest.fn(),
      cancelled: false
    };

    grpcQueue.enqueue(eventId, new Grpc.Request({id: eventId}), mockCall);

    const error = new Grpc.Error({
      id: eventId,
      code: 3,
      message: "Invalid argument"
    });

    grpcQueueClient.sendError(error, (e, result) => {
      expect(e).not.toBe(null);
      expect(e.message).toContain("Invalid argument");
      expect(grpcQueue.size).toEqual(0);
      done();
    });
  });

  it("should handle cancelled calls", done => {
    const eventId = "5";

    const mockCall = {
      sendMetadata: jest.fn(),
      sendMessage: jest.fn(),
      end: jest.fn(),
      cancelled: true
    };

    grpcQueue.enqueue(eventId, new Grpc.Request({id: eventId}), mockCall);

    const response = new Grpc.Response({
      id: eventId,
      data: Buffer.from(JSON.stringify({result: "test"}))
    });

    grpcQueueClient.sendResponse(response, (e, result) => {
      expect(e).not.toBe(null);
      expect(e.message).toContain("Call was cancelled");
      done();
    });
  });
});
