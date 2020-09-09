import {hooks} from "@spica-server/bucket/hooks/proto";
import * as grpc from "@grpc/grpc-js";

export class ReviewAndChangeQueue {
  private client: hooks.ChangeAndReviewQueueClient;
  constructor() {
    this.client = new hooks.ChangeAndReviewQueueClient(
      process.env.FUNCTION_GRPC_ADDRESS,
      grpc.credentials.createInsecure()
    );
  }

  pop(pop: hooks.Pop): Promise<hooks.ChangeOrReview> {
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

  result(result: hooks.Review.Result): Promise<hooks.Review.Result.Response> {
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
