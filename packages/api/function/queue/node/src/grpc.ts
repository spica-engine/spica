import {Grpc} from "@spica-server/function-queue-proto";
import grpc from "@grpc/grpc-js";

export class GrpcQueue {
  private client: Grpc.QueueClient;

  constructor() {
    const maxMessageSize = Number(process.env.FUNCTION_GRPC_MAX_MESSAGE_SIZE) || 25 * 1024 * 1024;
    this.client = new Grpc.QueueClient(
      process.env.FUNCTION_GRPC_ADDRESS,
      grpc.credentials.createInsecure(),
      {
        "grpc.max_receive_message_length": maxMessageSize,
        "grpc.max_send_message_length": maxMessageSize
      }
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

  respond(e: Grpc.Response): Promise<Grpc.Response.Result> {
    return new Promise((resolve, reject) => {
      this.client.respond(e, (error, event) => {
        if (error) {
          reject(error);
        } else {
          resolve(event);
        }
      });
    });
  }
}
