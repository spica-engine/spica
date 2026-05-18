import {Writable} from "stream";
import {StandartStream} from "./standart_stream.js";
import {StreamOptions} from "@spica-server/interface-function-runtime";

export class StandardStreamOutput extends StandartStream {
  create(_options: StreamOptions): [Writable, Writable] {
    const createWritable = (dest: NodeJS.WriteStream) =>
      new Writable({
        write(chunk, encoding, callback) {
          dest.write(chunk, encoding as BufferEncoding, callback);
        }
        // _final is not overridden intentionally — we must never call dest.end()
        // on process.stdout/stderr as that would close the process streams.
      });
    return [createWritable(process.stdout), createWritable(process.stderr)];
  }
}
