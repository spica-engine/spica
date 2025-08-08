import {Collection, DatabaseService} from "../../../../../../../libs/database";
import {PassThrough, Transform, Writable} from "stream";
import {StandartStream} from "./standart_stream";
import {getLogs} from "../../logger";
import {StreamOptions, LogChannels} from "../../../../../../../libs/interface/function/runtime";

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

          const logs = getLogs(message, channel);

          // don't use promise.all because order of logs is important
          try {
            logs.forEach(log => {
              this.collection.insertOne({
                function: options.functionId,
                event_id: options.eventId,
                channel,
                level: log.level,
                content: log.message,
                created_at: new Date()
              });
            });
            callback(undefined, data);
          } catch (error) {
            callback(error);
          }
        }
      });
    };
    return [
      new PassThrough().pipe(createTransform(LogChannels.OUT)),
      new PassThrough().pipe(createTransform(LogChannels.ERROR))
    ];
  }
}
