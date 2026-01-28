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

  it("should handle invalid JSON in sendResponse", done => {
    const eventId = "6";

    const mockCall = {
      sendMetadata: jest.fn(),
      sendMessage: jest.fn(),
      end: jest.fn(),
      cancelled: false
    };

    grpcQueue.enqueue(eventId, new Grpc.Request({id: eventId}), mockCall);
    expect(grpcQueue.size).toEqual(1);

    const response = new Grpc.Response({
      id: eventId,
      data: Buffer.from("invalid json {{{")
    });

    grpcQueueClient.sendResponse(response, (e, result) => {
      expect(e).toBeDefined();
      expect(e.message).toContain("Failed to parse response data");
      expect(mockCall.sendMessage).not.toHaveBeenCalled();
      expect(grpcQueue.size).toEqual(0);
      done();
    });
  });

  it("should handle concurrent pop requests for same ID", done => {
    const eventId = "8";

    const request = new Grpc.Request({
      id: eventId,
      service: "TestService",
      method: "TestMethod"
    });

    const mockCall = {
      sendMetadata: jest.fn(),
      sendMessage: jest.fn(),
      end: jest.fn(),
      cancelled: false
    };

    grpcQueue.enqueue(eventId, request, mockCall);

    const pop = new Grpc.Request.Pop({id: eventId});

    let firstCallSucceeded = false;
    let secondCallFailed = false;

    grpcQueueClient.pop(pop, (e1, req1) => {
      if (!e1 && req1) {
        firstCallSucceeded = true;
      }

      grpcQueueClient.pop(pop, (e2, req2) => {
        if (e2 && e2.message.includes("Queue has no item")) {
          secondCallFailed = true;
        }

        expect(firstCallSucceeded).toBe(true);
        expect(secondCallFailed).toBe(true);
        expect(grpcQueue.size).toEqual(0);
        done();
      });
    });
  });

  it("should verify memory cleanup when calls are cancelled", done => {
    const eventId = "9";

    const mockCall = {
      sendMetadata: jest.fn(),
      sendMessage: jest.fn(),
      end: jest.fn(),
      cancelled: true
    };

    const request = new Grpc.Request({id: eventId});

    grpcQueue.enqueue(eventId, request, mockCall);
    expect(grpcQueue.size).toEqual(1);

    const {call} = grpcQueue.get(eventId);
    expect(call).toBeDefined();
    expect(call.cancelled).toBe(true);

    const response = new Grpc.Response({
      id: eventId,
      data: Buffer.from(JSON.stringify({test: "data"}))
    });

    grpcQueueClient.sendResponse(response, e => {
      expect(e).toBeDefined();
      expect(e.message).toContain("cancelled");
      const {request: req, call: cleanedCall} = grpcQueue.get(eventId);
      expect(req).toBeUndefined();
      expect(cleanedCall).toBeUndefined();
      done();
    });
  });

  it("should handle metadata error edge cases", done => {
    const testCases = [
      {
        name: "special characters in value",
        metadata: [{key: "x-custom-header", value: "special!@#$%"}]
      },
      {
        name: "numeric key",
        metadata: [{key: "x-request-id", value: "12345"}]
      },
      {
        name: "large value",
        metadata: [{key: "x-large-header", value: "x".repeat(1000)}]
      }
    ];

    const promises = testCases.map((testCase, index) => {
      return new Promise<void>((resolve, reject) => {
        const eventId = `meta-${index}`;

        const mockCall = {
          sendMetadata: jest.fn(),
          sendMessage: jest.fn(),
          end: jest.fn(),
          cancelled: false
        };

        const request = new Grpc.Request({
          id: eventId,
          service: "TestService",
          method: "TestMethod",
          metadata: testCase.metadata.map(m => {
            const header = new Grpc.Header();
            header.key = m.key;
            header.value = m.value;
            return header;
          })
        });

        grpcQueue.enqueue(eventId, request, mockCall);

        const response = new Grpc.Response({
          id: eventId,
          metadata: testCase.metadata.map(m => {
            const header = new Grpc.Header();
            header.key = m.key;
            header.value = m.value;
            return header;
          }),
          data: Buffer.from(JSON.stringify({result: "ok"}))
        });

        grpcQueueClient.sendResponse(response, (e, result) => {
          if (e) {
            reject(new Error(`${testCase.name} failed: ${e.message}`));
          } else {
            expect(mockCall.sendMetadata).toHaveBeenCalled();
            expect(grpcQueue.size).toEqual(0);
            resolve();
          }
        });
      });
    });

    Promise.all(promises)
      .then(() => done())
      .catch(err => done(err));
  });
});
