import {Request, Response} from "express";
import {ObjectId} from "@spica-server/database";

export interface StatusOptions {
  expireAfterSeconds: number;
}

export type AttachStatusTracker = (req: Request, res: Response) => void;

export interface ApiStatus {
  _id?: ObjectId;
  count: number;
  request: {
    size: number;
  };
  response: {
    size: number;
  };
}

export const STATUS_OPTIONS = Symbol.for("STATUS_OPTIONS");
export const ATTACH_STATUS_TRACKER = Symbol.for("ATTACH_STATUS_TRACKER");
