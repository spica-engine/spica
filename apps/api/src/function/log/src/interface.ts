import {ObjectId} from "@spica-server/database";
import {LogLevels, LogChannels} from "@spica-server/function/runtime/logger";

export interface Log {
  _id: ObjectId;
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
