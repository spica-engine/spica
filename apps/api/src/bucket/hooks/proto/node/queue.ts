import {hooks} from "@spica/api/src/bucket/hooks/proto";
import * as grpc from "@grpc/grpc-js";

export class ChangeQueue {
  private client: hooks.ChangeQueueClient;
  constructor() {
    this.client = new hooks.ChangeQueueClient(
      process.env.FUNCTION_GRPC_ADDRESS,
      grpc.credentials.createInsecure()
    );
  }

  pop(pop: hooks.Pop): Promise<hooks.Change> {
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
