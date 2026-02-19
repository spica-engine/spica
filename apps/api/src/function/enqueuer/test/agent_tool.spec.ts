import {INestApplication} from "@nestjs/common";
import {Test} from "@nestjs/testing";
import {CoreTestingModule, Request} from "@spica-server/core/testing";
import {AgentToolEnqueuer} from "@spica-server/function/enqueuer";
import {AgentToolQueue} from "@spica-server/function/queue";
import {event} from "@spica-server/function/queue/proto";

function createTarget(cwd?: string, handler?: string) {
  const target = new event.Target();
  target.cwd = cwd || "/tmp/fn1";
  target.handler = handler || "default";
  return target;
}

describe("AgentToolEnqueuer", () => {
  let app: INestApplication;
  let req: Request;
  let enqueuer: AgentToolEnqueuer;
  let agentToolQueue: AgentToolQueue;

  let eventQueue: {enqueue: jest.Mock};
  let schedulerUnsubscriptionSpy: jest.Mock;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      imports: [CoreTestingModule]
    }).compile();

    app = module.createNestApplication();
    req = module.get(Request);

    eventQueue = {enqueue: jest.fn()};
    agentToolQueue = new AgentToolQueue();
    schedulerUnsubscriptionSpy = jest.fn();

    await app.listen(req.socket);

    enqueuer = new AgentToolEnqueuer(
      eventQueue as any,
      agentToolQueue,
      app.getHttpAdapter().getInstance(),
      schedulerUnsubscriptionSpy
    );
  });

  afterEach(() => app.close());

  describe("subscribe / unsubscribe", () => {
    it("should register a tool on subscribe", async () => {
      enqueuer.subscribe(createTarget(), {
        name: "get_weather",
        description: "Get weather for a city",
        parameters: {type: "object", properties: {city: {type: "string"}}}
      });

      const res = await req.post("/mcp", {jsonrpc: "2.0", method: "tools/list", id: 1});
      expect(res.statusCode).toBe(200);
      expect(res.body.result.tools.length).toBe(1);
      expect(res.body.result.tools[0].name).toBe("get_weather");
    });

    it("should remove a tool on unsubscribe", async () => {
      const target = createTarget();
      enqueuer.subscribe(target, {
        name: "get_weather",
        description: "Get weather for a city",
        parameters: {type: "object"}
      });
      enqueuer.unsubscribe(target);

      const res = await req.post("/mcp", {jsonrpc: "2.0", method: "tools/list", id: 2});
      expect(res.body.result.tools.length).toBe(0);
    });

    it("should remove only tools matching the target", async () => {
      const target1 = createTarget("/fn1", "a");
      const target2 = createTarget("/fn2", "b");

      enqueuer.subscribe(target1, {name: "tool_a", description: "A", parameters: {type: "object"}});
      enqueuer.subscribe(target2, {name: "tool_b", description: "B", parameters: {type: "object"}});

      enqueuer.unsubscribe(target1);

      const res = await req.post("/mcp", {jsonrpc: "2.0", method: "tools/list", id: 3});
      expect(res.body.result.tools.length).toBe(1);
      expect(res.body.result.tools[0].name).toBe("tool_b");
    });
  });

  describe("tools/list", () => {
    it("should return empty tools list when nothing is registered", async () => {
      const res = await req.post("/mcp", {jsonrpc: "2.0", method: "tools/list", id: 1});
      expect(res.statusCode).toBe(200);
      expect(res.body.jsonrpc).toBe("2.0");
      expect(res.body.result.tools).toEqual([]);
      expect(res.body.id).toBe(1);
    });

    it("should include inputSchema from parameters", async () => {
      const params = {type: "object", properties: {city: {type: "string"}}};
      enqueuer.subscribe(createTarget(), {name: "t1", description: "desc", parameters: params});

      const res = await req.post("/mcp", {jsonrpc: "2.0", method: "tools/list", id: 2});
      expect(res.body.result.tools[0].inputSchema).toEqual(params);
    });

    it("should include outputSchema when provided", async () => {
      const outSchema = {type: "object", properties: {temp: {type: "number"}}};
      enqueuer.subscribe(createTarget(), {
        name: "t2",
        description: "desc",
        parameters: {type: "object"},
        outputSchema: outSchema
      });

      const res = await req.post("/mcp", {jsonrpc: "2.0", method: "tools/list", id: 3});
      expect(res.body.result.tools[0].outputSchema).toEqual(outSchema);
    });

    it("should omit outputSchema when not provided", async () => {
      enqueuer.subscribe(createTarget(), {
        name: "t3",
        description: "desc",
        parameters: {type: "object"}
      });

      const res = await req.post("/mcp", {jsonrpc: "2.0", method: "tools/list", id: 4});
      expect(res.body.result.tools[0].outputSchema).toBeUndefined();
    });

    it("should list multiple registered tools", async () => {
      enqueuer.subscribe(createTarget("/fn1", "a"), {
        name: "tool_a",
        description: "A",
        parameters: {type: "object"}
      });
      enqueuer.subscribe(createTarget("/fn2", "b"), {
        name: "tool_b",
        description: "B",
        parameters: {type: "object"}
      });

      const res = await req.post("/mcp", {jsonrpc: "2.0", method: "tools/list", id: 5});
      const names = res.body.result.tools.map((t: any) => t.name);
      expect(names).toContain("tool_a");
      expect(names).toContain("tool_b");
      expect(res.body.result.tools.length).toBe(2);
    });
  });

  describe("tools/call", () => {
    it("should return error when tool name is missing", async () => {
      const res = await req.post("/mcp", {
        jsonrpc: "2.0",
        method: "tools/call",
        params: {},
        id: 1
      });
      expect(res.body.error.code).toBe(-32602);
      expect(res.body.error.message).toContain("missing tool name");
    });

    it("should return error when tool is not found", async () => {
      const res = await req.post("/mcp", {
        jsonrpc: "2.0",
        method: "tools/call",
        params: {name: "nonexistent"},
        id: 2
      });
      expect(res.body.error.code).toBe(-32602);
      expect(res.body.error.message).toContain("nonexistent");
    });

    it("should enqueue event and return result on successful call", async () => {
      enqueuer.subscribe(createTarget(), {
        name: "echo",
        description: "Echo tool",
        parameters: {type: "object"}
      });

      eventQueue.enqueue.mockImplementation(() => {
        expect(agentToolQueue.size).toBe(1);
      });

      const callPromise = req.post("/mcp", {
        jsonrpc: "2.0",
        method: "tools/call",
        params: {name: "echo", arguments: {text: "hello"}},
        id: 3
      });

      await new Promise(r => setTimeout(r, 20));

      const resolvers = (agentToolQueue as any).resolvers as Map<string, any>;
      for (const [, resolver] of resolvers) {
        resolver.resolve(Buffer.from(JSON.stringify([{type: "text", text: "hello"}])));
      }

      const res = await callPromise;
      expect(res.statusCode).toBe(200);
      expect(res.body.result.content).toEqual([{type: "text", text: "hello"}]);
      expect(res.body.id).toBe(3);
    });

    it("should return isError when tool execution fails", async () => {
      enqueuer.subscribe(createTarget(), {
        name: "fail_tool",
        description: "Fails",
        parameters: {type: "object"}
      });

      eventQueue.enqueue.mockImplementation(() => {});

      const callPromise = req.post("/mcp", {
        jsonrpc: "2.0",
        method: "tools/call",
        params: {name: "fail_tool", arguments: {}},
        id: 4
      });

      await new Promise(r => setTimeout(r, 20));

      const resolvers = (agentToolQueue as any).resolvers as Map<string, any>;
      for (const [, resolver] of resolvers) {
        resolver.reject(new Error("Something went wrong"));
      }

      const res = await callPromise;
      expect(res.statusCode).toBe(200);
      expect(res.body.result.isError).toBe(true);
      expect(res.body.result.content[0].text).toContain("Something went wrong");
    });
  });

  describe("authentication", () => {
    beforeEach(() => {
      enqueuer.subscribe(createTarget("/auth", "handler"), {
        name: "secure_tool",
        description: "Requires auth",
        parameters: {type: "object"},
        auth: {type: "apikey", key: "secret123"}
      });
    });

    it("should reject when API key is missing", async () => {
      const res = await req.post("/mcp", {
        jsonrpc: "2.0",
        method: "tools/call",
        params: {name: "secure_tool", arguments: {}},
        id: 1
      });
      expect(res.body.error.code).toBe(-32603);
      expect(res.body.error.message).toContain("Authentication failed");
    });

    it("should reject when API key is wrong", async () => {
      const res = await req.post(
        "/mcp",
        {
          jsonrpc: "2.0",
          method: "tools/call",
          params: {name: "secure_tool", arguments: {}},
          id: 2
        },
        {"x-api-key": "wrong_key"}
      );
      expect(res.body.error.code).toBe(-32603);
      expect(res.body.error.message).toContain("Authentication failed");
    });

    it("should accept when API key is correct via header", async () => {
      eventQueue.enqueue.mockImplementation(() => {});

      const callPromise = req.post(
        "/mcp",
        {
          jsonrpc: "2.0",
          method: "tools/call",
          params: {name: "secure_tool", arguments: {}},
          id: 3
        },
        {"x-api-key": "secret123"}
      );

      await new Promise(r => setTimeout(r, 20));

      const resolvers = (agentToolQueue as any).resolvers as Map<string, any>;
      for (const [, resolver] of resolvers) {
        resolver.resolve(Buffer.from("ok"));
      }

      const res = await callPromise;
      expect(res.statusCode).toBe(200);
      expect(res.body.error).toBeUndefined();
      expect(res.body.result).toBeDefined();
    });

    it("should accept bearer auth when token is correct", async () => {
      enqueuer.subscribe(createTarget("/bearer", "handler"), {
        name: "bearer_tool",
        description: "Bearer auth",
        parameters: {type: "object"},
        auth: {type: "bearer", key: "tok3n"}
      });

      eventQueue.enqueue.mockImplementation(() => {});

      const callPromise = req.post(
        "/mcp",
        {
          jsonrpc: "2.0",
          method: "tools/call",
          params: {name: "bearer_tool", arguments: {}},
          id: 4
        },
        {authorization: "Bearer tok3n"}
      );

      await new Promise(r => setTimeout(r, 20));

      const resolvers = (agentToolQueue as any).resolvers as Map<string, any>;
      for (const [, resolver] of resolvers) {
        resolver.resolve(Buffer.from("ok"));
      }

      const res = await callPromise;
      expect(res.statusCode).toBe(200);
      expect(res.body.error).toBeUndefined();
    });

    it("should allow calls to tools without auth config", async () => {
      enqueuer.subscribe(createTarget("/noauth", "handler"), {
        name: "open_tool",
        description: "No auth needed",
        parameters: {type: "object"}
      });

      eventQueue.enqueue.mockImplementation(() => {});

      const callPromise = req.post("/mcp", {
        jsonrpc: "2.0",
        method: "tools/call",
        params: {name: "open_tool", arguments: {}},
        id: 5
      });

      await new Promise(r => setTimeout(r, 20));

      const resolvers = (agentToolQueue as any).resolvers as Map<string, any>;
      for (const [, resolver] of resolvers) {
        resolver.resolve(Buffer.from("allowed"));
      }

      const res = await callPromise;
      expect(res.statusCode).toBe(200);
      expect(res.body.error).toBeUndefined();
    });
  });

  describe("error handling", () => {
    it("should return -32600 for invalid JSON-RPC request", async () => {
      const res = await req.post("/mcp", {not: "valid"});
      expect(res.statusCode).toBe(400);
      expect(res.body.error.code).toBe(-32600);
      expect(res.body.error.message).toBe("Invalid Request");
    });

    it("should return -32601 for unknown method", async () => {
      const res = await req.post("/mcp", {jsonrpc: "2.0", method: "unknown/method", id: 1});
      expect(res.statusCode).toBe(200);
      expect(res.body.error.code).toBe(-32601);
      expect(res.body.error.message).toContain("unknown/method");
    });
  });

  describe("onEventsAreDrained", () => {
    it("should reject pending resolvers and dequeue events", async () => {
      const rejectSpy = jest.fn();
      const resolveSpy = jest.fn();
      agentToolQueue.enqueue("evt-1", {} as any, resolveSpy, rejectSpy);

      const events = [new event.Event({id: "evt-1", type: event.Type.AGENT_TOOL})];
      await enqueuer.onEventsAreDrained(events);

      expect(rejectSpy).toHaveBeenCalled();
      expect(agentToolQueue.size).toBe(0);
    });
  });
});
