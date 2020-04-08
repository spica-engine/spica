import {Event} from "@spica-server/function/queue/proto";
import * as grpc from "grpc";
import * as uniqid from "uniqid";
import {Queue} from "./queue";

export class EventQueue {
  private server: grpc.Server;
  private queue = new Map<string, Event.Event>();

  get size(): number {
    return this.queue.size;
  }

  constructor(private _enqueueCallback: (event: Event.Event) => void) {
    this._create();
  }

  private _create() {
    this.server = new grpc.Server();
    this.server.addService(Event.Queue, {
      pop: this.pop.bind(this)
    });
  }

  drain() {
    this.server.forceShutdown();
    this._create();
  }

  listen() {
    this.server.bind("0.0.0.0:5678", grpc.ServerCredentials.createInsecure());
    this.server.start();
  }

  /**
   * ATTENTION: Do not use this method since it is only designed for testing.
   */
  kill(): Promise<void> {
    return new Promise(resolve => this.server.tryShutdown(resolve));
  }

  enqueue(event: Event.Event) {
    // TODO: Handle overflow
    event.id = uniqid();
    this.queue.set(event.id, event);
    this._enqueueCallback(event);
  }

  pop(call: grpc.ServerUnaryCall<Event.Event>, callback: grpc.sendUnaryData<Event.Event>) {
    if (!this.queue.has(call.request.id)) {
      callback(new Error(`Queue has no item with id ${call.request.id}.`), undefined);
    } else {
      const event = this.queue.get(call.request.id);
      this.queue.delete(event.id);
      callback(undefined, event);
    }
  }

  addQueue<T>(queue: Queue<T>) {
    try {
      this.server.addService(queue.TYPE, queue.create());
    } catch (e) {
      console.log(e);
    }
  }
}
