import {Event} from "@spica-server/function/queue/proto";
import * as grpc from "@grpc/grpc-js";
import * as uniqid from "uniqid";
import * as util from "util";
import {Queue} from "./queue";

export class EventQueue {
  private server: grpc.Server;

  constructor(
    private _enqueueCallback: (event: Event.Event) => void,
    private _gotWorker: (id: string, schedule: (event: Event.Event) => void) => void,
    private _cancel: (event: Event.Event)  => void
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

  async listen() {
    await util
      .promisify(this.server.bindAsync)
      .call(
        this.server,
        process.env.FUNCTION_GRPC_ADDRESS,
        grpc.ServerCredentials.createInsecure()
      );
    this.server.start();
  }

  /**
   * ATTENTION: Do not use this method since it is only designed for testing.
   */
  kill(): Promise<void> {
    return util.promisify(this.server.tryShutdown).call(this.server);
  }

  enqueue(event: Event.Event) {
    event.id = uniqid();
    this._enqueueCallback(event);
  }

  dequeue(event: Event.Event) {
    this._cancel(event);
  }

  async pop(
    call: grpc.ServerUnaryCall<Event.Pop, Event.Event>,
    callback: grpc.sendUnaryData<Event.Event>
  ) {
    const event = await new Promise<Event.Event>(resolve => this._gotWorker(call.request.id, resolve));
    callback(undefined, event);
  }

  addQueue<T>(queue: Queue<T>) {
    try {
      this.server.addService(queue.TYPE, queue.create() as any);
    } catch (e) {
      console.log(e);
    }
  }
}
