import {EventEmitter} from "events";
import {Writable} from "stream";
import * as child_process from "child_process";

export interface Description {
  name: string;
  title: string;
  description?: string;
  bin: string;
  versions: string[];
}

export interface Execution {
  id: string;
  cwd: string;
  timeout?: number;
  env?: {
    [k: string]: string;
  };
  stdout: Writable | "ignore" | "inherit";
}

export abstract class Worker {
  abstract attach(stdout?: Writable, stderr?: Writable): void;
  abstract kill(): Promise<void>;
  abstract once(eventName: "exit", listener: (...args: unknown[]) => void): void;
}

export interface SpawnOptions {
  id: string;
  runtime: {
    name: string;
    version: string;
  };
  environment: {
    [key: string]: string;
  };
}
