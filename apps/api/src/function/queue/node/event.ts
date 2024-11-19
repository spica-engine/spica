import {event} from "@spica/api/src/function/queue/proto";
import * as grpc from "@grpc/grpc-js";

export class EventQueue {
  private client: any;

  constructor() {
    this.client = new event.QueueClient(
      process.env.FUNCTION_GRPC_ADDRESS,
      grpc.credentials.createInsecure()
    );
  }

  pop(pop: event.Pop): Promise<event.Event> {
    return new Promise((resolve, reject) => {
      this.client.pop(pop, (error, event) => {
        if (error) {
          reject(error);
        } else {
          resolve(event);
        }
      });
    });
  }

  complete(complete: event.Complete): Promise<event.Complete.Result> {
    return new Promise((resolve, reject) => {
      this.client.complete(complete, (error, event) => {
        if (error) {
          reject(error);
        } else {
          resolve(event);
        }
      });
    });
  }
}
