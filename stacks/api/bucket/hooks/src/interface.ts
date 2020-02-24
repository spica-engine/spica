import {Event} from "@spica-server/function/queue/proto";

export interface BucketEnqueuerOptions {
  collection: string;
  type: "INSERT" | "UPDATE" | "GET" | "INDEX";
}

export interface BucketAction {
  target: Event.Target;
  options: BucketEnqueuerOptions;
}
