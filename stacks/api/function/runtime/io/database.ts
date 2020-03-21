import {Collection, DatabaseService} from "@spica-server/database";
import {PassThrough, Transform, Writable} from "stream";
import {StdOut, StdOutOptions} from "./stdout";

export class DatabaseOutput extends StdOut {
  private collection: Collection;
  constructor(private db: DatabaseService) {
    super();
    this.collection = this.db.collection("function_logs");
  }

  create(options: StdOutOptions): Writable {
    const transform = new Transform({
      transform: (data, _, callback) => {
        this.collection
          .insertOne({
            function: options.functionId,
            event_id: options.eventId,
            content: Buffer.from(data)
              .toString()
              .trim()
          })
          .then(() => callback(undefined, data))
          .catch(error => callback(error));
      }
    });
    return new PassThrough().pipe(transform);
  }
}
