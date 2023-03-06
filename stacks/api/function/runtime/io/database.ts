import {Collection, DatabaseService} from "@spica-server/database";
import {PassThrough, Transform, Writable} from "stream";
import {StandartStream, StreamOptions} from "./standart_stream";
import {seperateMessageAndLevel, LogChannels} from "@spica-server/function/runtime/logger";

export class DatabaseOutput extends StandartStream {
  private collection: Collection;
  constructor(private db: DatabaseService) {
    super();
    this.collection = this.db.collection("function_logs");
  }

  create(options: StreamOptions): [Writable, Writable] {
    const createTransform = (channel: LogChannels) => {
      return new Transform({
        transform: (data, _, callback) => {
          let message: any = Buffer.from(data).toString();

          const {level, message: _message} = seperateMessageAndLevel(message, channel);

          this.collection
            .insertOne({
              function: options.functionId,
              event_id: options.eventId,
              channel,
              level,
              content: _message,
              created_at: new Date()
            })
            .then(() => callback(undefined, data))
            .catch(error => callback(error));
        }
      });
    };
    return [
      new PassThrough().pipe(createTransform(LogChannels.OUT)),
      new PassThrough().pipe(createTransform(LogChannels.ERROR))
    ];
  }
}
