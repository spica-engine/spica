import {Action} from "@spica-server/bucket/hooks/proto";
import * as grpc from "grpc";

export class ActionQueue extends Action.QueueClient {
  constructor() {
    super("0.0.0.0:5678", grpc.credentials.createInsecure());
  }
}
