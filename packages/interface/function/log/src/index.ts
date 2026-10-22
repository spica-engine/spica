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

export interface LogRepository {
  /**
   * Deletes the function's logs, optionally only those created in the range or at the levels.
   */
  deleteByFunction(
    functionId: string,
    options?: {createdBetween?: {from: Date; to: Date}; levels?: number[]}
  ): Promise<number>;
}

export const FUNCTION_LOG_REPOSITORY = Symbol.for("FUNCTION_LOG_REPOSITORY");
