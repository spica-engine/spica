import {PassThrough, Writable} from "stream";
import {StandartStream} from "./standart_stream.js";
import {StreamOptions} from "@spica-server/interface-function-runtime";

export class PassThroughOutput extends StandartStream {
  create(options: StreamOptions): [Writable, Writable] {
    return [new PassThrough(), new PassThrough()];
  }
}
