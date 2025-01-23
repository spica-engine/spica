import {EventEmitter} from "events";
import {Writable} from "stream";
import {Dirname} from "@spica-server/core/node";

export abstract class Runtime {
  abstract description: Description;
  abstract spawn(options: SpawnOptions, dirname: Dirname): Worker;
}

export interface SpawnOptions {
  id: string;
  env: {
    [key: string]: string;
  };
}

export interface Description {
  name: string;
  title: string;
  description?: string;
}

export interface Execution {
  stdout: Writable | "ignore" | "inherit";
  env?: {
    [k: string]: string;
  };
  memoryLimit?: number;
  timeout?: number;
  cwd: string;
  eventId: string;
}

export abstract class Worker extends EventEmitter {
  abstract attach(stdout?: Writable, stderr?: Writable): void;
  abstract kill(): Promise<void>;
}
