import {Writable} from "stream";

export interface StreamOptions {
  eventId: string;
  functionId: string;
}

export abstract class StandartStream {
  abstract create(options: StreamOptions): [Writable, Writable];
}
