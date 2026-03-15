import {GrpcEnqueuer} from "@spica-server/function/enqueuer";
import {GrpcQueue} from "@spica-server/function/queue";
import {event, Grpc} from "@spica-server/function/queue/proto";
import grpc from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader";
import fs from "fs";
import path from "path";
import os from "os";

function createTarget(cwd?: string, handler?: string) {
  const target = new event.Target();
  target.cwd = cwd || "/tmp/fn1";
  target.handler = handler || "default";
  return target;
}

describe("grpc enqueuer", () => {
  describe("unit tests (no server binding)", () => {
    let grpcEnqueuer: GrpcEnqueuer;
    let grpcQueue: GrpcQueue;
    let noopTarget: event.Target;

    let eventQueue: {enqueue: jest.Mock; dequeue: jest.Mock};
    let schedulerUnsubscriptionSpy: jest.Mock;

    // Use port 0 to avoid actually binding in unit tests
    // rebuildServer will fail to bind but registrations are still tracked
    const testPort = 0;

    beforeEach(() => {
      noopTarget = createTarget();

      eventQueue = {
        enqueue: jest.fn(),
        dequeue: jest.fn()
      };

      grpcQueue = new GrpcQueue();
      schedulerUnsubscriptionSpy = jest.fn();

      grpcEnqueuer = new GrpcEnqueuer(
        eventQueue as any,
        grpcQueue,
        schedulerUnsubscriptionSpy,
        testPort
      );
    });

    afterEach(() => {
      // Force shutdown any server
      if (grpcEnqueuer["server"]) {
        grpcEnqueuer["server"].forceShutdown();
        grpcEnqueuer["server"] = null;
      }
      grpcEnqueuer["registrations"].clear();
    });

    it("should have correct type and description", () => {
      expect(grpcEnqueuer.type).toEqual(event.Type.GRPC);
      expect(grpcEnqueuer.description.name).toEqual("grpc");
      expect(grpcEnqueuer.description.title).toEqual("gRPC");
    });

    it("should subscribe and register the handler", () => {
      const options = {
        requestParams: [{name: "message", type: "string" as const}],
        responseParams: [{name: "reply", type: "string" as const}]
      };
      grpcEnqueuer.subscribe(noopTarget, options);

      const registrations = grpcEnqueuer["registrations"];
      expect(registrations.size).toEqual(1);
      expect(registrations.has("/tmp/fn1:default")).toBe(true);
    });

    it("should unsubscribe and remove the handler", () => {
      const options = {
        requestParams: [{name: "message", type: "string" as const}],
        responseParams: [{name: "reply", type: "string" as const}]
      };

      const target1 = createTarget("/tmp/fn1", "handler1");
      const target2 = createTarget("/tmp/fn1", "handler2");

      grpcEnqueuer.subscribe(target1, options);
      grpcEnqueuer.subscribe(target2, options);

      expect(grpcEnqueuer["registrations"].size).toEqual(2);

      grpcEnqueuer.unsubscribe(target1);

      expect(grpcEnqueuer["registrations"].size).toEqual(1);
      expect(grpcEnqueuer["registrations"].has("/tmp/fn1:handler2")).toBe(true);
      expect(schedulerUnsubscriptionSpy).toHaveBeenCalled();
    });

    it("should unsubscribe all handlers for a function when handler is not specified", () => {
      const options = {
        requestParams: [{name: "message", type: "string" as const}],
        responseParams: [{name: "reply", type: "string" as const}]
      };

      const target1 = createTarget("/tmp/fn1", "handler1");
      const target2 = createTarget("/tmp/fn1", "handler2");
      const target3 = createTarget("/tmp/fn2", "handler1");

      grpcEnqueuer.subscribe(target1, options);
      grpcEnqueuer.subscribe(target2, options);
      grpcEnqueuer.subscribe(target3, options);

      expect(grpcEnqueuer["registrations"].size).toEqual(3);

      const unsubTarget = new event.Target();
      unsubTarget.cwd = "/tmp/fn1";
      grpcEnqueuer.unsubscribe(unsubTarget);

      expect(grpcEnqueuer["registrations"].size).toEqual(1);
      expect(grpcEnqueuer["registrations"].has("/tmp/fn2:handler1")).toBe(true);
    });

    it("should shutdown server when all registrations are removed", () => {
      const options = {
        requestParams: [{name: "message", type: "string" as const}],
        responseParams: [{name: "reply", type: "string" as const}]
      };

      grpcEnqueuer.subscribe(noopTarget, options);
      expect(grpcEnqueuer["server"]).not.toBeNull();

      grpcEnqueuer.unsubscribe(noopTarget);
      expect(grpcEnqueuer["server"]).toBeNull();
    });

    it("should generate valid proto string", () => {
      const registrations = [
        {
          target: createTarget("/tmp/fn1", "sayHello"),
          options: {
            requestParams: [
              {name: "name", type: "string" as const},
              {name: "age", type: "int32" as const}
            ],
            responseParams: [{name: "greeting", type: "string" as const}]
          }
        }
      ];

      const proto = grpcEnqueuer["generateProto"]("MyService", registrations);

      expect(proto).toContain('syntax = "proto3"');
      expect(proto).toContain("package MyService");
      expect(proto).toContain("service MyService");
      expect(proto).toContain("rpc sayHello (sayHelloRequest) returns (sayHelloResponse)");
      expect(proto).toContain("message sayHelloRequest");
      expect(proto).toContain("string name = 1");
      expect(proto).toContain("int32 age = 2");
      expect(proto).toContain("message sayHelloResponse");
      expect(proto).toContain("string greeting = 1");
    });

    it("should handle onEventsAreDrained by sending error responses", async () => {
      const id = "test-drain-id";
      const responseCallback = jest.fn();

      grpcQueue.enqueue(id, new Grpc.Request({id, body: "{}"}), responseCallback);

      const drainEvent = new event.Event({
        target: noopTarget,
        type: event.Type.GRPC
      });
      drainEvent.id = id;

      await grpcEnqueuer.onEventsAreDrained([drainEvent]);

      expect(responseCallback).toHaveBeenCalled();
      const response = responseCallback.mock.calls[0][0];
      expect(response.error).toContain("drained");
    });

    it("should sanitize identifiers", () => {
      expect(grpcEnqueuer["sanitizeIdentifier"]("my-func")).toEqual("my_func");
      expect(grpcEnqueuer["sanitizeIdentifier"]("my.func")).toEqual("my_func");
      expect(grpcEnqueuer["sanitizeIdentifier"]("myFunc123")).toEqual("myFunc123");
    });
  });

  describe("integration (with server binding)", () => {
    let grpcEnqueuer: GrpcEnqueuer;
    let grpcQueue: GrpcQueue;
    let eventQueue: {enqueue: jest.Mock; dequeue: jest.Mock};
    const integrationPort = 50062;

    beforeEach(() => {
      eventQueue = {
        enqueue: jest.fn(),
        dequeue: jest.fn()
      };
      grpcQueue = new GrpcQueue();
      grpcEnqueuer = new GrpcEnqueuer(eventQueue as any, grpcQueue, jest.fn(), integrationPort);
    });

    afterEach(async () => {
      if (grpcEnqueuer["server"]) {
        grpcEnqueuer["server"].forceShutdown();
        grpcEnqueuer["server"] = null;
      }
      grpcEnqueuer["registrations"].clear();
      await new Promise(r => setTimeout(r, 200));
    });

    it("should enqueue event when gRPC call is received", async () => {
      const target = createTarget("/tmp/fn1", "default");
      const options = {
        requestParams: [{name: "name", type: "string" as const}],
        responseParams: [{name: "greeting", type: "string" as const}]
      };

      grpcEnqueuer.subscribe(target, options);

      // Wait for server to fully bind
      await new Promise(r => setTimeout(r, 1000));

      const protoContent = grpcEnqueuer["generateProto"]("fn1", [{target, options}]);
      const tmpFile = path.join(os.tmpdir(), `test_grpc_${Date.now()}.proto`);
      fs.writeFileSync(tmpFile, protoContent);

      let client: any;
      try {
        const packageDefinition = protoLoader.loadSync(tmpFile, {
          keepCase: true,
          longs: String,
          enums: String,
          defaults: true,
          oneofs: true
        });
        const grpcObject = grpc.loadPackageDefinition(packageDefinition);
        const ServiceClient = (grpcObject.fn1 as any).fn1;
        client = new ServiceClient(
          `localhost:${integrationPort}`,
          grpc.credentials.createInsecure()
        );

        client.default({name: "world"}, () => {});

        await new Promise(r => setTimeout(r, 500));

        expect(eventQueue.enqueue).toHaveBeenCalled();
        const enqueuedEvent = eventQueue.enqueue.mock.calls[0][0];
        expect(enqueuedEvent.type).toEqual(event.Type.GRPC);
      } finally {
        if (client) client.close();
        try {
          fs.unlinkSync(tmpFile);
        } catch {}
      }
    });
  });
});
