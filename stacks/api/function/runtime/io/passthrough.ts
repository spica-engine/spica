import {PassThrough} from "stream";
import {StdOut, StdOutOptions} from "./stdout";

export class PassThroughOutput extends StdOut {

  create(options: StdOutOptions) {
    return new PassThrough();
  }
}
