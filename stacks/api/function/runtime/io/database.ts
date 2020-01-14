import {DatabaseService} from "@spica-server/database";
import {PassThrough, Writable} from "stream";
import {StdOut, StdOutOptions} from "./stdout";

export class DatabaseOutput extends StdOut {
  constructor(private db: DatabaseService) {
    super();
  }

  create(options: StdOutOptions, callback?: () => void): Writable {
    this.db
      .createCollection("function_logs", {capped: true, size: 419430400 /* 400Mi */})
      .then(callback);
    return new PassThrough().on("data", data => {
      this.db.collection("function_logs").insertOne({
        function: options.functionId,
        event_id: options.eventId,
        content: Buffer.from(data).toString()
      });
    });
  }
}
