import {DatabaseService} from "@spica-server/database";
import {PassThrough, Writable} from "stream";
import {StdOut, StdOutOptions} from "./stdout";

export class DatabaseOutput extends StdOut {
  constructor(private db: DatabaseService) {
    super();
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
      this.db.collection("function_logs").insertOne({
        function: options.functionId,
        event_id: options.eventId,
        content: Buffer.from(data)
          .toString()
          .trim()
      });
    });
  }
}
