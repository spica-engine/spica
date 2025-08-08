import {Writable} from "stream";
import {StreamOptions} from "../../../../../../../libs/interface/function/runtime";

export abstract class StandartStream {
  abstract create(options: StreamOptions): [Writable, Writable];
}
