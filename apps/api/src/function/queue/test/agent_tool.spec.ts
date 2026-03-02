import {AgentToolQueue, EventQueue} from "@spica-server/function/queue";
import {AgentTool} from "@spica-server/function/queue/proto";
import {credentials} from "@grpc/grpc-js";

process.env.FUNCTION_GRPC_ADDRESS = "0.0.0.0:5855";

describe("AgentToolQueue", () => {
  let queue: EventQueue;
  let agentToolQueue: AgentToolQueue;
  let agentToolQueueClient: any;

  beforeEach(async () => {
    queue = new EventQueue(
      () => {},
      () => {},
      () => {},
      () => {}
    );
    agentToolQueue = new AgentToolQueue();
    queue.addQueue(agentToolQueue);
    await queue.listen();
    agentToolQueueClient = new AgentTool.QueueClient(
      process.env.FUNCTION_GRPC_ADDRESS,
      credentials.createInsecure()
    );
  });

  afterEach(async () => {
    agentToolQueueClient.close();
    await queue.kill();
  });

  describe("pop", () => {
    it("should return error for nonexistent events", done => {
      const pop = new AgentTool.Message.Pop();
      pop.id = "1";
      agentToolQueueClient.pop(pop, (e, req) => {
        expect(e).not.toBeUndefined();
        expect(e.message).toBe("2 UNKNOWN: Queue has no item with id 1");
        expect(req).toBeUndefined();

        expect(agentToolQueue.size).toEqual(0);

        done();
      });
    });

    it("should pop a queued message", done => {
      const pop = new AgentTool.Message.Pop();
      pop.id = "2";

      const message = new AgentTool.Message({
        id: "2",
        tool_name: "test_tool",
        arguments: Buffer.from(JSON.stringify({query: "hello"}))
      });

      agentToolQueue.enqueue(
        pop.id,
        message,
        () => {},
        () => {}
      );
      expect(agentToolQueue.size).toEqual(1);

      agentToolQueueClient.pop(pop, (e, req) => {
        expect(e).toBe(null);
        expect(req instanceof AgentTool.Message).toBe(true);
        expect(req.tool_name).toBe("test_tool");
        expect(Buffer.from(req.arguments).toString("utf-8")).toBe('{"query":"hello"}');

        expect(agentToolQueue.size).toEqual(0);

        done();
      });
    });
  });

  describe("respond", () => {
    it("should return error for nonexistent events", done => {
      const msg = new AgentTool.Message();
      msg.id = "nonexistent";
      msg.result = Buffer.from("result");

      agentToolQueueClient.respond(msg, (e, _res) => {
        expect(e).not.toBeUndefined();
        expect(e.message).toContain("No pending request with id nonexistent");
        done();
      });
    });

    it("should resolve the pending promise with result", done => {
      const eventId = "resolve-test";

      const message = new AgentTool.Message({
        id: eventId,
        tool_name: "test_tool",
        arguments: Buffer.from("{}")
      });

      const resultPromise = new Promise<Uint8Array>((resolve, reject) => {
        agentToolQueue.enqueue(eventId, message, resolve, reject);
      });

      resultPromise.then(result => {
        expect(Buffer.from(result).toString("utf-8")).toBe("tool result data");
        done();
      });

      // Pop first so the message is consumed by worker
      const pop = new AgentTool.Message.Pop({id: eventId});
      agentToolQueueClient.pop(pop, () => {
        const response = new AgentTool.Message();
        response.id = eventId;
        response.result = Buffer.from("tool result data");

        agentToolQueueClient.respond(response, (e, _res) => {
          expect(e).toBe(null);
        });
      });
    });

    it("should reject the pending promise on error", done => {
      const eventId = "reject-test";

      const message = new AgentTool.Message({
        id: eventId,
        tool_name: "test_tool",
        arguments: Buffer.from("{}")
      });

      const resultPromise = new Promise<Uint8Array>((resolve, reject) => {
        agentToolQueue.enqueue(eventId, message, resolve, reject);
      });

      resultPromise.catch(error => {
        expect(error.message).toBe("Something went wrong");
        done();
      });

      const pop = new AgentTool.Message.Pop({id: eventId});
      agentToolQueueClient.pop(pop, () => {
        const response = new AgentTool.Message();
        response.id = eventId;
        response.error = Buffer.from("Something went wrong");

        agentToolQueueClient.respond(response, (e, _res) => {
          expect(e).toBe(null);
        });
      });
    });
  });
});
