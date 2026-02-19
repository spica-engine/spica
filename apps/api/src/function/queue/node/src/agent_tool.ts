import {AgentTool} from "@spica-server/function/queue/proto";
import grpc from "@grpc/grpc-js";

export class AgentToolQueue {
  private client: AgentTool.QueueClient;

  constructor() {
    this.client = new AgentTool.QueueClient(
      process.env.FUNCTION_GRPC_ADDRESS,
      grpc.credentials.createInsecure()
    );
  }

  pop(e: AgentTool.Message.Pop): Promise<AgentTool.Message> {
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

  respond(e: AgentTool.Message): Promise<AgentTool.Message.Result> {
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
