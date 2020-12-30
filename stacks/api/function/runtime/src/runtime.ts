import {Writable} from "stream";

export interface Description {
  name: string;
  title: string;
  description?: string;
  bin: string;
  prepare: string;
  pkgmanager: string;
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

export interface Worker {
  attach(stdout?: Writable, stderr?: Writable): void;
  kill(): Promise<void>;
  once(eventName: "exit" | "error", listener: (...args: unknown[]) => void): void;
  once(eventName: "exit", listener: (code: number) => void): void;
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
