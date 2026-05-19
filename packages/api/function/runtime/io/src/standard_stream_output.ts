import {PassThrough, Transform, Writable} from "stream";
import {StandartStream} from "./standart_stream.js";
import {getLogs} from "@spica-server/function-runtime-logger";
import {LogChannels, LogLevels, StreamOptions} from "@spica-server/interface-function-runtime";

export class StandardStreamOutput extends StandartStream {
  create(options: StreamOptions): [Writable, Writable] {
    const createTransform = (channel: LogChannels, dest: NodeJS.WriteStream) =>
      new Transform({
        transform(data, _, callback) {
          const logs = getLogs(Buffer.from(data).toString(), channel);
          for (const log of logs) {
            // _final is not overridden intentionally — we must never call dest.end()
            // on process.stdout/stderr as that would close the process streams.
            dest.write(
              `${new Date().toISOString()} [${options.functionName ?? options.functionId}:${options.handler}] ${LogLevels[log.level]} ${log.message}\n`
            );
          }
          callback();
        }
      });

    return [
      new PassThrough().pipe(createTransform(LogChannels.OUT, process.stdout)),
      new PassThrough().pipe(createTransform(LogChannels.ERROR, process.stderr))
    ];
  }
}
