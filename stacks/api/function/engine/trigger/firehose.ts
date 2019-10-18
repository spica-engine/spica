import {Module, OnModuleInit} from "@nestjs/common";
import {HttpAdapterHost} from "@nestjs/core";
import * as url from "url";
import * as ws from "ws";
import {Info, InvokerFn, Target, Trigger, TriggerFlags, TriggerSchema} from "./base";

export class FirehoseClient {
  constructor(private client: any) {}

  get remoteAddress() {
    return this.client.remoteAddress;
  }

  close(): void {
    this.client.close();
  }

  send(name: string, data: any) {
    this.client.send(JSON.stringify({name, data}));
  }
}

export class FirehosePool {
  constructor(private wss: any) {}

  get size() {
    return this.wss.clients.size;
  }

  send(name: string, data: any) {
    const raw = JSON.stringify({name, data});
    this.wss.clients.forEach((client: any) => {
      if (client.readyState === ws.OPEN) {
        client.send(raw);
      }
    });
  }

  heartbeat() {
    this.send("heartbeat", Date.now());
  }
}

export interface FirehoseOptions {
  event: "*" | "**" | "connection" | "disconnect" | string;
}

@Trigger({
  name: "firehose",
  flags: TriggerFlags.NotSubscribable
})
export class FirehoseTrigger implements Trigger<FirehoseOptions>, OnModuleInit {
  private eventTargetMap = new Map<string, {event: string; invoker: InvokerFn; target: Target}>();

  wss: ws.Server;

  private pool: FirehosePool;

  constructor(private http: HttpAdapterHost) {}

  onModuleInit() {
    this.wss = new ws.Server({noServer: true});
    this.pool = new FirehosePool(this.wss);

    this.wss.on("connection", (ws, req) => {
      const cl = new FirehoseClient(ws);
      this.invoke("connection", cl, req);

      ws["alive"] = true;
      ws.on("message", (raw: string) => {
        try {
          const event = JSON.parse(raw);
          if (event.name == "heartbeat") {
            ws["alive"] = true;
          }
          if (typeof event.name == "string") {
            this.invoke(event.name, cl, event.data);
          }
        } catch {}
      });
      ws.on("close", () => this.invoke("close", cl));
    });

    setInterval(() => {
      this.wss.clients.forEach((ws: any) => {
        if (!ws.alive) {
          return ws.terminate();
        }
        ws.alive = false;
      });
      this.pool.heartbeat();
    }, 30000);

    const server = this.http.httpAdapter.getHttpServer();
    const [socketIoUpgrade] = server.listeners("upgrade");
    server.removeAllListeners("upgrade");
    server.on("upgrade", (request, socket, head) => {
      const pathname = url.parse(request.url).pathname;

      if (pathname == "/firehose") {
        this.wss.handleUpgrade(request, socket, head, ws =>
          this.wss.emit("connection", ws, request)
        );
      } else if (socketIoUpgrade) {
        socketIoUpgrade(request, socket, head);
      } else {
        socket.destroy();
      }
    });
  }

  handleUpgrade() {}

  invoke(name: string, client: any, data?: any) {
    for (const pair of this.eventTargetMap.values()) {
      if (
        pair.event == name ||
        pair.event == "*" ||
        (pair.event == "**" && (name == "connection" || name == "close"))
      ) {
        console.log(name);
        pair.invoker({
          target: pair.target,
          parameters: [
            {client, pool: this.pool},
            {name, [name == "connection" ? "request" : "data"]: data}
          ]
        });
      }
    }
  }

  register(invoker: InvokerFn, target: Target, options: FirehoseOptions) {
    const key = `${options.event}_${target.id}_${target.handler}`;
    if (invoker) {
      this.eventTargetMap.set(key, {event: options.event, invoker, target});
    } else {
      this.eventTargetMap.delete(key);
    }
  }

  schema(): Promise<TriggerSchema> {
    return Promise.resolve({
      $id: "http://spica.internal/function/triggers/firehose/schema",
      title: "Firehose",
      description: "A low latency realtime trigger for functions",
      type: "object",
      required: ["event"],
      properties: {
        event: {
          title: "Event",
          description:
            "For all events use '*'. For connection events use '**'. For custom events use the event name.",
          type: "string",
          examples: ["*", "**", "connection", "close", "mycustomevent"]
        }
      },
      additionalProperties: false
    });
  }

  info(options: FirehoseOptions): Promise<Info[]> {
    const infoMap = {
      "*": "Firehose: All events",
      "**": "Firehose: All connection events"
    };
    const info: Info = {
      icon: "compare_arrows",
      text: infoMap[options.event] || `Firehose: on ${options.event}`,
      type: "label"
    };
    return Promise.resolve([info]);
  }
}

@Module({
  providers: [FirehoseTrigger],
  exports: [FirehoseTrigger]
})
export class FirehoseTriggerModule {}
