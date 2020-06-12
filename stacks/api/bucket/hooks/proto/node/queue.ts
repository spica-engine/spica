import {Action} from "@spica-server/bucket/hooks/proto";
import * as grpc from "grpc";

export class ActionQueue extends Action.QueueClient {
  constructor() {
    super(process.env.FUNCTION_GRPC_ADDRESS, grpc.credentials.createInsecure());
  }
}
