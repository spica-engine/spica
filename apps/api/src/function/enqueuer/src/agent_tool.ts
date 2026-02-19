import {EventQueue, AgentToolQueue} from "@spica-server/function/queue";
import {Enqueuer} from "./enqueuer";
import {Description, AgentToolOptions} from "@spica-server/interface/function/enqueuer";
import {event, AgentTool} from "@spica-server/function/queue/proto";
import express from "express";
import uniqid from "uniqid";

interface ToolRegistration {
  target: event.Target;
  options: AgentToolOptions;
}

export class AgentToolEnqueuer extends Enqueuer<AgentToolOptions> {
  type = event.Type.AGENT_TOOL;

  description: Description = {
    title: "Agent Tool",
    name: "agent_tool",
    icon: "smart_toy",
    description:
      "MCP tool trigger for AI agents. Registers functions as tools on the built-in MCP server."
  };

  private registry = new Map<string, ToolRegistration>();
  private router = express.Router();

  constructor(
    private queue: EventQueue,
    private agentToolQueue: AgentToolQueue,
    httpServer: express.Application,
    private schedulerUnsubscription: (targetId: string) => void
  ) {
    super();

    this.router.use(express.json() as any);
    this.router.post("/", this.handleRequest.bind(this));

    const stack = httpServer._router.stack;
    httpServer.use("/mcp", this.router);
    const expressInitIndex = stack.findIndex(l => l.name === "expressInit");
    const layer = stack.splice(stack.length - 1, 1)[0];
    stack.splice(expressInitIndex + 1, 0, layer);
  }

  subscribe(target: event.Target, options: AgentToolOptions): void {
    this.registry.set(options.name, {target, options});
  }

  unsubscribe(target: event.Target): void {
    this.schedulerUnsubscription(target.id);

    for (const [toolName, registration] of this.registry.entries()) {
      const isCwdEqual = registration.target.cwd == target.cwd;
      const isHandlerEqual = registration.target.handler == target.handler;
      const isMatchingTarget = target.handler ? isHandlerEqual && isCwdEqual : isCwdEqual;

      if (isMatchingTarget) {
        this.registry.delete(toolName);
      }
    }
  }

  onEventsAreDrained(events: event.Event[]): Promise<any> {
    for (const ev of events) {
      const resolver = (this.agentToolQueue as any).resolvers?.get(ev.id);
      if (resolver) {
        resolver.reject(new Error("Service unavailable"));
      }
      this.agentToolQueue.dequeue(ev.id);
    }
    return Promise.resolve();
  }

  private async handleRequest(req: express.Request, res: express.Response) {
    const body = req.body;

    if (!body || body.jsonrpc !== "2.0" || !body.method) {
      return res.status(400).json({
        jsonrpc: "2.0",
        error: {code: -32600, message: "Invalid Request"},
        id: body?.id ?? null
      });
    }

    switch (body.method) {
      case "tools/list":
        return this.handleToolsList(body, res);
      case "tools/call":
        return this.handleToolsCall(body, req, res);
      default:
        return res.status(200).json({
          jsonrpc: "2.0",
          error: {code: -32601, message: `Method not found: ${body.method}`},
          id: body.id ?? null
        });
    }
  }

  private handleToolsList(body: any, res: express.Response) {
    const tools = Array.from(this.registry.values()).map(({options}) => {
      const tool: any = {
        name: options.name,
        description: options.description,
        inputSchema: options.parameters
      };
      if (options.outputSchema) {
        tool.outputSchema = options.outputSchema;
      }
      return tool;
    });

    return res.status(200).json({
      jsonrpc: "2.0",
      result: {tools},
      id: body.id ?? null
    });
  }

  private async handleToolsCall(body: any, req: express.Request, res: express.Response) {
    const params = body.params;
    if (!params || !params.name) {
      return res.status(200).json({
        jsonrpc: "2.0",
        error: {code: -32602, message: "Invalid params: missing tool name"},
        id: body.id ?? null
      });
    }

    const registration = this.registry.get(params.name);
    if (!registration) {
      return res.status(200).json({
        jsonrpc: "2.0",
        error: {code: -32602, message: `Tool not found: ${params.name}`},
        id: body.id ?? null
      });
    }

    const authError = this.validateAuth(registration.options, req);
    if (authError) {
      return res.status(200).json({
        jsonrpc: "2.0",
        error: {code: -32603, message: authError},
        id: body.id ?? null
      });
    }

    const ev = new event.Event({
      id: uniqid(),
      type: event.Type.AGENT_TOOL,
      target: registration.target
    });

    const message = new AgentTool.Message({
      id: ev.id,
      tool_name: params.name,
      arguments: Buffer.from(JSON.stringify(params.arguments || {}))
    });

    try {
      const resultPromise = new Promise<Uint8Array>((resolve, reject) => {
        this.agentToolQueue.enqueue(ev.id, message, resolve, reject);
      });

      this.queue.enqueue(ev);

      const resultBytes = await resultPromise;
      const resultContent = Buffer.from(resultBytes).toString("utf-8");

      let content;
      try {
        content = JSON.parse(resultContent);
      } catch {
        content = [{type: "text", text: resultContent}];
      }

      return res.status(200).json({
        jsonrpc: "2.0",
        result: {content: Array.isArray(content) ? content : [{type: "text", text: resultContent}]},
        id: body.id ?? null
      });
    } catch (error) {
      return res.status(200).json({
        jsonrpc: "2.0",
        result: {
          content: [{type: "text", text: error.message || "Tool execution failed"}],
          isError: true
        },
        id: body.id ?? null
      });
    }
  }

  private validateAuth(options: AgentToolOptions, req: express.Request): string | null {
    if (!options.auth) {
      return null;
    }

    const {type, key} = options.auth;

    if (type === "apikey") {
      const provided = (req.headers["x-api-key"] as string) || (req.query["apikey"] as string);
      if (provided !== key) {
        return "Authentication failed: invalid API key";
      }
    } else if (type === "bearer") {
      const authHeader = req.headers["authorization"] as string;
      if (!authHeader || !authHeader.startsWith("Bearer ") || authHeader.slice(7) !== key) {
        return "Authentication failed: invalid bearer token";
      }
    }

    return null;
  }
}
