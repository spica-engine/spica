import {Action} from "@spica-server/bucket/hooks/proto";
import * as grpc from "@grpc/grpc-js";

export class ActionQueue {
  private client: Action.QueueClient;
  constructor() {
    this.client = new Action.QueueClient(
      process.env.FUNCTION_GRPC_ADDRESS,
      grpc.credentials.createInsecure()
    );
  }

  pop(pop: Action.Action.Pop): Promise<Action.Action> {
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

  result(result: Action.Result): Promise<Action.Result.Response> {
    return new Promise((resolve, reject) => {
      this.client.result(result, (error, event) => {
        if (error) {
          reject(error);
        } else {
          resolve(event);
        }
      });
    });
  }
}
