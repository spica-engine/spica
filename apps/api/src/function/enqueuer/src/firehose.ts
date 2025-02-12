import {EventQueue, FirehoseQueue} from "@spica-server/function/queue";
import {event, Firehose} from "@spica-server/function/queue/proto";
import url from "url";
import ws, {WebSocketServer} from "ws";
import {Description, Enqueuer} from "./enqueuer";
import express from "express";

interface FirehoseOptions {
  event: "*" | "**" | "connection" | "close" | string;
}

export class FirehoseEnqueuer extends Enqueuer<FirehoseOptions> {
  type = event.Type.FIREHOSE;

  onEventsAreDrained(events: event.Event[]): Promise<any> {
    return Promise.resolve();
  }

  readonly description: Description = {
    icon: "compare_arrows",
    name: "firehose",
    title: "Firehose",
    description: "Designed for low latency bi-directional messaging."
  };

  private wss: WebSocketServer;

  private eventTargetPairs = new Set<{name: string; target: event.Target}>();

  constructor(
    private queue: EventQueue,
    private firehoseQueue: FirehoseQueue,
    server: express.Application,
    private schedulerUnsubscription: (targetId: string) => void
  ) {
    super();

    this.wss = new WebSocketServer({noServer: true});
    const [socketIoUpgrade] = server.listeners("upgrade");
    server.removeAllListeners("upgrade");
    server.addListener("upgrade", (request, socket, head) => {
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

    this.wss.on("connection", (ws, req) => {
      ws["alive"] = true;

      const clDescription = new Firehose.ClientDescription({
        id: String(ws["_socket"]["_handle"]["fd"]),
        remoteAddress: req.connection.remoteAddress
      });

      this.invoke(ws, clDescription, "connection", {
        url: req.url
      });

      const messageHandler = (raw: string) => {
        ws["alive"] = true;

        try {
          const event = JSON.parse(raw);
          if (typeof event.name == "string") {
            this.invoke(ws, clDescription, event.name, event.data);
          }
        } catch {}
      };
      ws.on("message", messageHandler);

      // Handle pong events
      // https://tools.ietf.org/html/rfc6455#section-5.5.3

      const pongHandler = () => (ws["alive"] = true);

      ws.on("pong", pongHandler);

      ws.once("close", code => {
        ws.off("message", messageHandler);
        ws.off("pong", pongHandler);
        // 4000 is reserved for server-side close calls
        if (code != 4000) {
          this.invoke(ws, clDescription, "close");
        }
      });
    });

    // Send ping requests every 30 seconds and kill clients which
    // has been inactive and did not respond to ping request
    // https://tools.ietf.org/html/rfc6455#section-5.5.2
    setInterval(() => {
      this.wss.clients.forEach(ws => {
        if (ws["alive"] === false) return ws.terminate();
        ws["alive"] = false;
        ws.ping(() => {});
      });
    }, 30000);
  }

  private invoke(ws: ws, cl: Firehose.ClientDescription, name: string, data?: any) {
    for (const pair of this.eventTargetPairs) {
      if (
        pair.name == name ||
        pair.name == "*" ||
        (pair.name == "**" && (name == "connection" || name == "close"))
      ) {
        const ev = new event.Event({
          target: pair.target,
          type: event.Type.FIREHOSE
        });
        this.queue.enqueue(ev);

        const incomingMessage = new Firehose.Message.Incoming({
          client: cl,
          message: new Firehose.Message({
            name
          }),
          pool: new Firehose.PoolDescription({
            size: this.wss.clients.size
          })
        });

        if (data) {
          incomingMessage.message.data = JSON.stringify(data);
        }

        this.firehoseQueue.enqueue(ev.id, incomingMessage, ws);
      }
    }
  }

  subscribe(target: event.Target, options: FirehoseOptions): void {
    this.eventTargetPairs.add({
      name: options.event,
      target
    });
  }

  // @TODO: unsubscribed targets won't be able to listen to client messages,
  // but they can still send message from server until worker be lost.
  // we may decide to block this behaviour
  unsubscribe(target: event.Target): void {
    this.schedulerUnsubscription(target.id);

    for (const pair of this.eventTargetPairs) {
      if (
        (!target.handler && pair.target.cwd == target.cwd) ||
        (target.handler && pair.target.cwd == target.cwd && pair.target.handler == target.handler)
      ) {
        this.eventTargetPairs.delete(pair);
      }
    }
  }
}
