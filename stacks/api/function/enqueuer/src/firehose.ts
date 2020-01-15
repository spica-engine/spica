import {EventQueue, FirehoseQueue} from "@spica-server/function/queue";
import {Event, Firehose} from "@spica-server/function/queue/proto";
import * as url from "url";
import * as ws from "ws";
import {Description, Enqueuer} from "./enqueuer";
import express = require("express");

interface FirehoseOptions {
  event: "*" | "**" | "connection" | "disconnect" | string;
}

export class FirehoseEnqueuer extends Enqueuer<FirehoseOptions> {
  readonly description: Description = {
    icon: "compare_arrows",
    name: "firehose",
    title: "Firehose",
    description: "Designed for low latency bi-directional messaging."
  };

  private wss: ws.Server;

  private eventTargetPairs = new Set<{name: string; target: Event.Target}>();

  constructor(
    private queue: EventQueue,
    private firehoseQueue: FirehoseQueue,
    server: express.Application
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

    const invoke = (cl: Firehose.ClientDescription, name: string, data?: any) => {
      for (const pair of this.eventTargetPairs) {
        if (
          pair.name == name ||
          pair.name == "*" ||
          (pair.name == "**" && (name == "connection" || name == "close"))
        ) {
          const event = new Event.Event();
          event.target = pair.target;
          event.type = Event.Type.FIREHOSE;

          this.queue.enqueue(event);

          const incomingMessage = new Firehose.Message.Incoming();
          incomingMessage.client = cl;
          incomingMessage.message = new Firehose.Message();
          incomingMessage.message.name = name;
          if (data) {
            incomingMessage.message.data = JSON.stringify(data);
          }

          this.firehoseQueue.enqueue(event.id, incomingMessage);
        }
      }
    };

    this.wss.on("connection", (ws, req) => {
      ws["alive"] = true;

      const clDescription = new Firehose.ClientDescription();
      clDescription.id = String(ws["_socket"]["_handle"]["fd"]);
      clDescription.remoteAddress = req.connection.remoteAddress;

      invoke(clDescription, "connection");

      const messageHandler = (raw: string) => {
        ws["alive"] = true;

        try {
          const event = JSON.parse(raw);
          if (typeof event.name == "string") {
            invoke(clDescription, event.name, event.data);
          }
        } catch {}
      };
      ws.on("message", messageHandler);

      // Handle pong events
      // https://tools.ietf.org/html/rfc6455#section-5.5.3
      ws.on("pong", () => (ws["alive"] = true));

      ws.once("close", () => {
        ws.off("message", messageHandler);
        invoke(clDescription, "close");
      });
    });

    // Send ping requests event 30 seconds and kill clients which
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

  subscribe(target: Event.Target, options: FirehoseOptions): void {
    this.eventTargetPairs.add({
      name: options.event,
      target
    });
  }
  unsubscribe(target: Event.Target): void {
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
