import {Event} from "@spica-server/function/queue/proto";
import * as grpc from "grpc";
import * as uniqid from "uniqid";
import {Queue} from "./queue";

export class EventQueue {
  private server: grpc.Server;
  private queue = new Map<string, Event.Event>();

  private _next = new Array<(event: Event.Event) => void>();

  get size(): number {
    return this.queue.size;
  }

  constructor(
    private _enqueueCallback: (event: Event.Event) => void,
    private _popCallback: (event: Event.Event, worker: string) => void
  ) {
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
    this.server.bind(process.env.FUNCTION_GRPC_ADDRESS, grpc.ServerCredentials.createInsecure());
    this.server.start();
  }

  /**
   * ATTENTION: Do not use this method since it is only designed for testing.
   */
  kill(): Promise<void> {
    return new Promise(resolve => this.server.tryShutdown(resolve));
  }

  enqueue(event: Event.Event) {
    event.id = uniqid();
    this.queue.set(event.id, event);
    this._enqueueCallback(event);
    if (this._next[0]) {
      this._next.shift()(event);
    }
  }

  async pop(call: grpc.ServerUnaryCall<Event.Event>, callback: grpc.sendUnaryData<Event.Event>) {
    let event: Event.Event;

    if (this.size == 0) {
      event = await new Promise(resolve => this._next.push(resolve));
    } else {
      event = this.queue.values().next().value;
    }

    this.queue.delete(event.id);
    this._popCallback(event, call.request.id);
    callback(undefined, event);
  }

  addQueue<T>(queue: Queue<T>) {
    try {
      this.server.addService(queue.TYPE, queue.create());
    } catch (e) {
      console.log(e);
    }
  }
}
