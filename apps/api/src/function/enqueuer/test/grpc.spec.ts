import {GrpcEnqueuer} from "@spica-server/function/enqueuer";
import {event} from "@spica-server/function/queue/proto";
import fs from "fs";
import os from "os";
import path from "path";
import {execSync} from "child_process";

function createTarget(cwd?: string, handler?: string) {
  const target = new event.Target();
  target.cwd = cwd || "/tmp/fn1";
  target.handler = handler || "default";
  return target;
}

describe("grpc enqueuer", () => {
  let grpcEnqueuer: GrpcEnqueuer;
  let noopTarget: event.Target;

  let eventQueue: {enqueue: jest.Mock; dequeue: jest.Mock};
  let grpcQueue: {enqueue: jest.Mock; dequeue: jest.Mock; get: jest.Mock};

  let schedulerUnsubscriptionSpy: jest.Mock;
  let testKey: string;
  let testCert: string;
  let tmpDir: string;

  beforeAll(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "grpc-test-"));
    const keyPath = path.join(tmpDir, "key.pem");
    const certPath = path.join(tmpDir, "cert.pem");

    execSync(
      `openssl req -x509 -nodes -newkey rsa:2048 -keyout ${keyPath} -out ${certPath} -days 1 -subj "/CN=localhost"`
    );

    testKey = fs.readFileSync(keyPath, "utf8");
    testCert = fs.readFileSync(certPath, "utf8");
  });

  afterAll(() => {
    try {
      fs.rmSync(tmpDir, {recursive: true, force: true});
    } catch (e) {
      console.error("Failed to remove temporary directory:", e);
    }
  });

  beforeEach(() => {
    noopTarget = createTarget();

    eventQueue = {
      enqueue: jest.fn(),
      dequeue: jest.fn()
    };

    grpcQueue = {
      enqueue: jest.fn(),
      dequeue: jest.fn(),
      get: jest.fn()
    };

    schedulerUnsubscriptionSpy = jest.fn();

    grpcEnqueuer = new GrpcEnqueuer(
      eventQueue as any,
      grpcQueue as any,
      schedulerUnsubscriptionSpy
    );
  });

  afterEach(() => {
    grpcEnqueuer["subscriptions"].forEach(sub => {
      if (sub.server) {
        sub.server.tryShutdown(() => {});
      }
    });
  });

  it("should subscribe to grpc service", async () => {
    const options = {
      service: "TestService",
      method: "TestMethod",
      host: "127.0.0.1",
      port: 50052
    };

    await grpcEnqueuer.subscribe(noopTarget, options);

    const subscriptions = grpcEnqueuer["subscriptions"];
    expect(subscriptions.length).toEqual(1);
    expect(subscriptions[0].target).toEqual(noopTarget);
    expect(subscriptions[0].options).toEqual(options);
    expect(subscriptions[0].closed).toBe(false);
    expect(subscriptions[0].server).toBeDefined();
  });

  it("should unsubscribe from grpc service", async () => {
    const options = {
      service: "TestService",
      method: "TestMethod",
      port: 50053
    };

    await grpcEnqueuer.subscribe(noopTarget, options);

    expect(grpcEnqueuer["subscriptions"].length).toEqual(1);

    grpcEnqueuer.unsubscribe(noopTarget);

    expect(schedulerUnsubscriptionSpy).toHaveBeenCalledWith(noopTarget.id);
    expect(grpcEnqueuer["subscriptions"].length).toEqual(0);
  });

  it("should handle multiple subscriptions", async () => {
    const target1 = createTarget("/tmp/fn1", "handler1");
    const target2 = createTarget("/tmp/fn2", "handler2");

    const options1 = {
      service: "Service1",
      method: "Method1",
      port: 50054
    };

    const options2 = {
      service: "Service2",
      method: "Method2",
      port: 50055
    };

    await grpcEnqueuer.subscribe(target1, options1);
    await grpcEnqueuer.subscribe(target2, options2);

    expect(grpcEnqueuer["subscriptions"].length).toEqual(2);

    grpcEnqueuer.unsubscribe(target1);

    expect(grpcEnqueuer["subscriptions"].length).toEqual(1);
    expect(grpcEnqueuer["subscriptions"][0].target).toEqual(target2);
  });

  it("should enqueue event when grpc call received", async () => {
    const options = {
      service: "TestService",
      method: "TestMethod",
      port: 50056
    };

    await grpcEnqueuer.subscribe(noopTarget, options);

    const mockCall = {
      request: {test: "data"},
      metadata: {
        getMap: () => ({
          "content-type": "application/grpc",
          "user-agent": "test-client"
        })
      },
      on: jest.fn()
    };

    const mockCallback = jest.fn();

    grpcEnqueuer["handleGrpcCall"](noopTarget, options, mockCall as any, mockCallback);

    expect(eventQueue.enqueue).toHaveBeenCalled();
    expect(grpcQueue.enqueue).toHaveBeenCalled();

    const enqueuedEvent = eventQueue.enqueue.mock.calls[0][0];
    expect(enqueuedEvent.type).toEqual(event.Type.GRPC);
    expect(enqueuedEvent.target).toEqual(noopTarget);
  });

  it("should handle errors during subscription", async () => {
    const options = {
      service: "TestService",
      method: "TestMethod",
      port: -1 // Invalid port to trigger error
    };

    await grpcEnqueuer.subscribe(noopTarget, options);

    const subscription = grpcEnqueuer["subscriptions"][0];
    expect(subscription.closed).toBe(true);
    expect(subscription.errorMessage).toBeDefined();
  });

  it("should start a secure (TLS) grpc server when cert/key provided", async () => {
    const options = {
      service: "SecureService",
      method: "SecureMethod",
      host: "127.0.0.1",
      port: 50060,
      key: testKey,
      cert: testCert
    };

    await grpcEnqueuer.subscribe(noopTarget, options);

    const subscriptions = grpcEnqueuer["subscriptions"];
    expect(subscriptions.length).toEqual(1);
    expect(subscriptions[0].server).toBeDefined();
    expect(subscriptions[0].closed).toBe(false);
  });
});
