import {Id} from "@spica-server/interface-data";
import {LogLevels, LogChannels} from "@spica-server/interface-function-runtime";

export interface Log {
  _id: Id;
  function: string;
  event_id: string;
  content: string;
  created_at: Date;
  channel: LogChannels;
  level: LogLevels;
}

export interface LogOptions {
  expireAfterSeconds: number;
  realtime: boolean;
}

export const FUNCTION_LOG_OPTIONS = Symbol.for("FUNCTION_LOG_OPTIONS");
