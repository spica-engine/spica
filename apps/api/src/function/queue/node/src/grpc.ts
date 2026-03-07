import {Grpc} from "@spica-server/function/queue/proto";
import grpc from "@grpc/grpc-js";

export class GrpcQueue {
  private client: Grpc.QueueClient;

  constructor() {
    this.client = new Grpc.QueueClient(
      process.env.FUNCTION_GRPC_ADDRESS,
      grpc.credentials.createInsecure()
    );
  }

  pop(e: Grpc.Request.Pop): Promise<Grpc.Request> {
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

  sendResponse(e: Grpc.Response): Promise<Grpc.Response.Result> {
    return new Promise((resolve, reject) => {
      this.client.sendResponse(e, (error, event) => {
        if (error) {
          reject(error);
        } else {
          resolve(event);
        }
      });
    });
  }

  sendError(e: Grpc.Error): Promise<Grpc.Error.Result> {
    return new Promise((resolve, reject) => {
      this.client.sendError(e, (error, event) => {
        if (error) {
          reject(error);
        } else {
          resolve(event);
        }
      });
    });
  }
}
