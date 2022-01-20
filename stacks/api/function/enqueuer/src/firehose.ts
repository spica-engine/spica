import {EventQueue, FirehoseQueue} from "@spica-server/function/queue";
import {event, Firehose} from "@spica-server/function/queue/proto";
import * as url from "url";
import * as ws from "ws";
import {Description, Enqueuer} from "./enqueuer";
import express = require("express");
import {v4 as uuid} from "uuid";

interface FirehoseOptions {
  event: "*" | "**" | "connection" | "close" | string;
}

export class FirehoseEnqueuer extends Enqueuer<FirehoseOptions> {
  readonly description: Description = {
    icon: "compare_arrows",
    name: "firehose",
    title: "Firehose",
    description: "Designed for low latency bi-directional messaging."
  };

  private wss: ws.Server;

  private eventTargetPairs = new Set<{name: string; target: event.Target}>();

  constructor(
    private queue: EventQueue,
    private firehoseQueue: FirehoseQueue,
    server: express.Application,
    private schedulerUnsubscription: (targetId: string) => void
  ) {
    super();

    this.wss = new ws.Server({noServer: true});
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
        id: uuid(),
        remoteAddress: req.connection.remoteAddress
      });

      ws["__id"] = clDescription.id;

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

      ws.once("close", () => {
        ws.off("message", messageHandler);
        ws.off("pong", pongHandler);
        this.invoke(ws, clDescription, "close");
        this.firehoseQueue.removeFromPool(ws["__id"]);
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
        this.firehoseQueue.removeFromPool(ws["__id"]);
      });
    }, 30000);
  }

  private invoke(ws: ws, cl: Firehose.ClientDescription, name: string, data?: any) {
    for (const pair of this.eventTargetPairs) {
      const ev = new event.Event({
        target: pair.target,
        type: event.Type.FIREHOSE
      });

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

      if (this.isListeningEvent(pair.name, name)) {
        this.queue.enqueue(ev);
        this.firehoseQueue.enqueue(ev.id, incomingMessage, ws);
      } else if (this.isConnection(name)) {
        this.firehoseQueue.addToPool(incomingMessage.client.id, ws);
      } else if (this.isClose(name)) {
        this.firehoseQueue.removeFromPool(incomingMessage.client.id);
      }
    }
  }

  private isListeningEvent(listening: string, incoming: string) {
    return (
      listening == incoming ||
      listening == "*" ||
      (listening == "**" && (incoming == "connection" || incoming == "close"))
    );
  }

  private isConnection(name: string) {
    return name == "connection";
  }

  private isClose(name: string) {
    return name == "close";
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
