import {Collection, DatabaseService} from "@spica-server/database";
import {PassThrough, Transform, Writable} from "stream";
import {StandartStream, StreamOptions} from "./standart_stream";

export class DatabaseOutput extends StandartStream {
  private collection: Collection;
  constructor(private db: DatabaseService) {
    super();
    this.collection = this.db.collection("function_logs");
  }

  create(options: StreamOptions): [Writable, Writable] {
    const createTransform = (channel: "stderr" | "stdout") => {
      return new Transform({
        transform: (data, _, callback) => {
          this.collection
            .insertOne({
              function: options.functionId,
              event_id: options.eventId,
              channel,
              content: Buffer.from(data)
                .toString()
                .trim(),
              created_at: new Date()
            })
            .then(() => callback(undefined, data))
            .catch(error => callback(error));
        }
      });
    };
    return [
      new PassThrough().pipe(createTransform("stdout")),
      new PassThrough().pipe(createTransform("stderr"))
    ];
  }
}
