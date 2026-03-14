import {Writable} from "stream";

export interface StreamOptions {
  eventId: string;
  functionId: string;
}

export interface SpawnOptions {
  id: string;
  env: {
    [key: string]: string;
  };
  entrypointPath?: string;
}

export interface Description {
  name: string;
  title: string;
  description?: string;
}

export enum LogLevels {
  DEBUG,
  LOG,
  INFO,
  WARN,
  ERROR
}

export enum LogChannels {
  OUT = "stdout",
  ERROR = "stderr"
}
