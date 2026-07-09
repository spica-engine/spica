import grpc from "@grpc/grpc-js";
import {event} from "@spica-server/function-queue-proto";
import uniqid from "uniqid";
import util from "util";
import {Queue} from "./queue.js";

export class EventQueue {
  private server: grpc.Server;
  private maxMessageSize: number;

  constructor(
    private _subscribe: (id: string, push: (event: event.Event) => void) => void,
    private _enqueue: (event: event.Event) => void,
    private _cancel: (id: string) => void,
    private _complete: (id: string, succedded: boolean) => void,
    maxMessageSize?: number
  ) {
    this.maxMessageSize = maxMessageSize || 25 * 1024 * 1024;
    this._create();
  }

  private _create() {
    this.server = new grpc.Server({
      "grpc.max_receive_message_length": this.maxMessageSize,
      "grpc.max_send_message_length": this.maxMessageSize
    });
    this.server.addService(event.Queue, {
      subscribe: (call: grpc.ServerWritableStream<event.Pop, event.Event>) => {
        // One long-lived stream per worker. Register a push fn the scheduler calls to
        // hand this worker an event; guard against writing after the worker's stream is
        // gone (the process's `exit` still drives the scheduler's worker cleanup).
        let closed = false;
        const close = () => {
          closed = true;
        };
        this._subscribe(call.request.id, event => {
          if (!closed && call.writable) {
            call.write(event);
          }
        });
        call.on("cancel", close);
        call.on("error", close);
        call.on("close", close);
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
