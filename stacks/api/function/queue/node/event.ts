import {Event} from "@spica-server/function/queue/proto";
import * as grpc from "@grpc/grpc-js";

export class EventQueue {
  private client: any;

  constructor() {
    this.client = new Event.QueueClient(
      process.env.FUNCTION_GRPC_ADDRESS,
      grpc.credentials.createInsecure()
    );
  }

  pop(pop: Event.Pop): Promise<Event.Event> {
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
}
