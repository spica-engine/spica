import {Event} from "@spica-server/function/queue/proto";
import * as grpc from "grpc";
import {Queue} from "./queue";

export class EventQueue {
  private server: grpc.Server;
  private queue = new Set<Event.Event>();

  get size(): number {
    return this.queue.size;
  }

  constructor(private _enqueueCallback: (event: Event.Event) => void) {}

  listen() {
    this.server = new grpc.Server();
    this.server.bind("0.0.0.0:5678", grpc.ServerCredentials.createInsecure());
    // TODO: remove try-catch statements since listen should b
    try {
      this.server.addService(Event.Queue, {
        pop: this.pop.bind(this)
      });
    } catch {}

    this.server.start();
  }

  kill() {
    this.server.forceShutdown();
    this.server = undefined;
  }

  enqueue(event: Event.Event) {
    this.queue.add(event);
    this._enqueueCallback(event);
  }

  pop(_: grpc.ServerUnaryCall<Event.Event>, callback: grpc.sendUnaryData<Event.Event>) {
    if (this.queue.size < 1) {
      callback(new Error("Queue is empty."), undefined);
    } else {
      const event = this.queue.values().next().value;
      this.queue.delete(event);
      callback(undefined, event);
    }
  }

  addQueue<T>(queue: Queue<T>) {
    try {
      this.server.addService(queue.TYPE, queue.create());
    } catch {}
  }
}
