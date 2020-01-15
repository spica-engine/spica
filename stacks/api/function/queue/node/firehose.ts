import {Firehose} from "@spica-server/function/queue/proto";
import * as grpc from "grpc";

export class FirehoseQueue {
  private client: any;

  constructor() {
    this.client = new Firehose.QueueClient("0.0.0.0:5678", grpc.credentials.createInsecure());
  }

  pop(e: Firehose.Message.Pop): Promise<Firehose.Message.Incoming> {
    return new Promise((resolve, reject) => {
      this.client.pop(e, (error, event) => {
        if (error) {
          reject(new Error(error.details));
        } else {
          resolve(event);
        }
      });
    });
  }
}
