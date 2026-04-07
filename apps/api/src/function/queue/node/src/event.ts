import {event} from "@spica-server/function/queue/proto";
import grpc from "@grpc/grpc-js";

export class EventQueue {
  private client: any;

  constructor() {
    const maxMessageSize = Number(process.env.FUNCTION_GRPC_MAX_MESSAGE_SIZE) || 25 * 1024 * 1024;
    this.client = new event.QueueClient(
      process.env.FUNCTION_GRPC_ADDRESS,
      grpc.credentials.createInsecure(),
      {
        "grpc.max_receive_message_length": maxMessageSize,
        "grpc.max_send_message_length": maxMessageSize
      }
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
