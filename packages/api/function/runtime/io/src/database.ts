import {Collection, DatabaseService} from "@spica-server/database";
import {PassThrough, Transform, Writable} from "stream";
import {StandartStream} from "./standart_stream.js";
import {getLogs} from "@spica-server/function-runtime-logger";
import {StreamOptions, LogChannels} from "@spica-server/interface-function-runtime";
import {Logger} from "@nestjs/common";

export class DatabaseOutput extends StandartStream {
  private collection: Collection;
  private readonly logger = new Logger(DatabaseOutput.name);

  constructor(private db: DatabaseService) {
    super();
    this.collection = this.db.collection("function_logs");
  }

  create(options: StreamOptions): [Writable, Writable] {
    const createTransform = (channel: LogChannels) => {
      return new Transform({
        transform: (data, _, callback) => {
          const message: any = Buffer.from(data).toString();

          const logs = getLogs(message, channel);

          for (const log of logs) {
            this.collection
              .insertOne({
                function: options.functionId,
                event_id: options.eventId,
                channel,
                level: log.level,
                content: log.message,
                created_at: new Date()
              })
              .catch(error =>
                this.logger.error(
                  `Failed to persist ${channel} log of function ${options.functionId}: ${error.message}`
                )
              );
          }

          callback(undefined, data);
        }
      });
    };
    return [
      new PassThrough().pipe(createTransform(LogChannels.OUT)),
      new PassThrough().pipe(createTransform(LogChannels.ERROR))
    ];
  }
}
