import {Database} from "@spica-server/function/queue/proto";
import grpc from "@grpc/grpc-js";

export class DatabaseQueue {
  private client: any;

  constructor() {
    this.client = new Database.QueueClient(
      process.env.FUNCTION_GRPC_ADDRESS,
      grpc.credentials.createInsecure()
    );
  }

  pop(e: Database.Change.Pop): Promise<Database.Change> {
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
  collection: string;
  documentKey: string;
  document?: T;
  updateDescription?: {
    removedFields: Array<string>;
    updatedFields: {[index: string]: unknown};
  };
  constructor(change: Database.Change) {
    switch (change.kind) {
      case Database.Change.Kind.INSERT:
        this.kind = "insert";
        break;
      case Database.Change.Kind.DELETE:
        this.kind = "delete";
        break;
      case Database.Change.Kind.UPDATE:
        this.kind = "update";
        break;
      case Database.Change.Kind.REPLACE:
        this.kind = "replace";
        break;
    }
    this.collection = change.collection;
    this.documentKey = change.documentKey;
    if (change.document) {
      this.document = JSON.parse(change.document);
    }

    if (change.kind == Database.Change.Kind.UPDATE) {
      this.updateDescription = {
        removedFields: JSON.parse(change.updateDescription.removedFields),
        updatedFields: JSON.parse(change.updateDescription.updatedFields)
      };
    }
  }
}
