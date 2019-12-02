import {Http} from "@spica-server/function/queue/proto";
import * as grpc from "grpc";

export class HttpQueue {
  private client: any;

  constructor() {
    this.client = new Http.QueueClient("0.0.0.0:5678", grpc.credentials.createInsecure());
  }

  pop(): Promise<Http.Request> {
    return new Promise((resolve, reject) => {
        this.client.pop(new Http.Request.Pop(), (error, event) => {
          if (error) {
            reject(error);
          } else {
            resolve(event);
          }
        });
    });
  }
}
