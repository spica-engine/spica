import {ObjectId} from "@spica-server/database";

export interface Log {
  _id: ObjectId;
  function: string;
  event_id: string;
  content: string;
  created_at: Date;
}

export interface LogOptions {
  expireAfterSeconds: number;
}

export const FUNCTION_LOG_OPTIONS = Symbol.for("FUNCTION_LOG_OPTIONS");
