import {PassThrough, Writable} from "stream";
import {StandartStream, StreamOptions} from "./standart_stream";

export class PassThroughOutput extends StandartStream {
  create(options: StreamOptions): [Writable, Writable] {
    return [new PassThrough(), new PassThrough()];
  }
}
