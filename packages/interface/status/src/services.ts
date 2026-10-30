import {Request, Response} from "express";
import {ExpiringRepository, Id} from "@spica-server/interface-data";

export interface StatusOptions {
  expireAfterSeconds: number;
  httpStatusTracking?: boolean;
}

export type AttachStatusTracker = (req: Request, res: Response) => void;

export interface ApiStatus {
  _id?: Id;
  created_at?: Date;
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

export interface ApiStatusSummary {
  request: number;
  uploaded: number;
  downloaded: number;
}

export interface StatusRepository extends ExpiringRepository {
  /**
   * Counts one request with its payload sizes, adding it to the current minute's totals.
   */
  record(status: Omit<ApiStatus, "_id" | "count">): Promise<unknown>;
  summarize(createdBetween?: {from: Date; to: Date}): Promise<ApiStatusSummary>;
}

export const STATUS_REPOSITORY = Symbol.for("STATUS_REPOSITORY");
