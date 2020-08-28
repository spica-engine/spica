import {DataChange} from "@spica-server/bucket/change/proto";
import * as grpc from "@grpc/grpc-js";

export class DataChangeQueue {
  private client: any;

  constructor() {
    this.client = new DataChange.QueueClient(
      process.env.FUNCTION_GRPC_ADDRESS,
      grpc.credentials.createInsecure()
    );
  }

  pop(e: DataChange.Change.Pop): Promise<DataChange.Change> {
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

export class Change<T = unknown> {
  kind: "insert" | "delete" | "update" | "replace";
  bucket: string;
  documentKey: string;
  previous?: Partial<T>;
  current?: Partial<T>;

  constructor(change: DataChange.Change) {
    switch (change.kind) {
      case DataChange.Change.Kind.INSERT:
        this.kind = "insert";
        break;
      case DataChange.Change.Kind.DELETE:
        this.kind = "delete";
        break;
      case DataChange.Change.Kind.UPDATE:
        this.kind = "update";
        break;
      case DataChange.Change.Kind.REPLACE:
        this.kind = "replace";
        break;
    }
    this.bucket = change.bucket;
    this.documentKey = change.documentKey;

    if (change.previous) {
      this.previous = JSON.parse(change.previous);
    }

    if (change.current) {
      this.current = JSON.parse(change.current);
    }
  }
}
