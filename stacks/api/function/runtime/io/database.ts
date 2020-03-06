import {DatabaseService, Collection} from "@spica-server/database";
import {PassThrough, Writable} from "stream";
import {StdOut, StdOutOptions} from "./stdout";

export class DatabaseOutput extends StdOut {
  private collection: Collection;
  constructor(private db: DatabaseService) {
    super();
    this.collection = this.db.collection("function_logs");
    this.db.createCollection("function_logs").catch(e => {
      if (e.codeName == "NamespaceExists") {
        // Do nothing
      } else {
        return Promise.reject(e);
      }
    });
  }

  create(options: StdOutOptions): Writable {
    return new PassThrough().on("data", data => {
      this.collection.insertOne({
        function: options.functionId,
        event_id: options.eventId,
        content: Buffer.from(data)
          .toString()
          .trim()
      });
    });
  }
}
