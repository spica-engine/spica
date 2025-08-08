import {PassThrough, Writable} from "stream";
import {StandartStream} from "./standart_stream";
import {StreamOptions} from "../../../../../../../libs/interface/function/runtime";

export class PassThroughOutput extends StandartStream {
  create(options: StreamOptions): [Writable, Writable] {
    return [new PassThrough(), new PassThrough()];
  }
}
