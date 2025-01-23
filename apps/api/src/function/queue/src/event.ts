import * as grpc from "@grpc/grpc-js";
import {event} from "@spica-server/function/queue/proto";
import * as uniqid from "uniqid";
import * as util from "util";
import {Queue} from "./queue";

export class EventQueue {
  private server: grpc.Server;

  constructor(
    private _ready: (id: string, schedule: (event: event.Event | undefined) => void) => void,
    private _enqueue: (event: event.Event) => void,
    private _cancel: (id: string) => void,
    private _complete: (id: string, succedded: boolean) => void
  ) {
    this._create();
  }

  private _create() {
    this.server = new grpc.Server();
    this.server.addService(event.Queue, {
      pop: async (
        call: grpc.ServerUnaryCall<event.Pop, event.Event>,
        callback: grpc.sendUnaryData<event.Event>
      ) => {
        this._ready(call.request.id, event => {
          if (!event) {
            callback({code: 5, details: "there is no next event."}, undefined);
          } else {
            callback(undefined, event);
          }
        });
      },
      complete: async (
        call: grpc.ServerUnaryCall<event.Complete, event.Event>,
        callback: grpc.sendUnaryData<event.Complete.Result>
      ) => {
        this._complete(call.request.id, call.request.succedded);
        callback(undefined, new event.Complete.Result());
      }
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
  }

  /**
   * ATTENTION: Do not use this method since it is only designed for testing.
   */
  kill(): Promise<void> {
    return util.promisify(this.server.tryShutdown).call(this.server);
  }

  enqueue(event: event.Event) {
    if (!event.id) {
      event.id = uniqid();
    }
    this._enqueue(event);
  }

  dequeue(event: event.Event) {
    this._cancel(event.id);
  }

  addQueue<T>(queue: Queue<T>) {
    try {
      this.server.addService(queue.TYPE, queue.create() as any);
    } catch (e) {
      console.log(e);
    }
  }
}
