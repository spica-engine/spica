import {EventEmitter} from "events";
import {Writable} from "stream";
import {SpawnOptions, Description} from "@spica-server/interface/function/runtime";

export abstract class Runtime {
  abstract description: Description;
  abstract spawn(options: SpawnOptions): Worker;
}

export abstract class Worker extends EventEmitter {
  abstract attach(stdout?: Writable, stderr?: Writable): void;
  abstract kill(): Promise<void>;
}
