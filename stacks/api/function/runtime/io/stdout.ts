import {Writable} from "stream";

export interface StdOutOptions {
  eventId: string;
  functionId: string;
}

export abstract class StdOut {
  abstract create(options: StdOutOptions): Writable;
}
