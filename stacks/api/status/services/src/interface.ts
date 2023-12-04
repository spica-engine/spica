import {Request, Response} from "express";

export interface StatusOptions {
  expireAfterSeconds: number;
}

export const STATUS_OPTIONS = Symbol.for("STATUS_OPTIONS");
export const ATTACH_HTTP_COUNTER = Symbol.for("ATTACH_HTTP_COUNTER");
export const ATTACH_INVOCATION_COUNTER = Symbol.for("ATTACH_INVOCATION_COUNTER");

export type AttachHttpCounter = (req: Request, res: Response) => void;

export type AttachInvocationCounter = (
  obj: object,
  methodName: string,
  statusBuilder: (...invocationArgs) => InvocationStatus
) => void;

export interface ApiStatus {
  request: {
    size: number;
  };
  response: {
    size: number;
  };
}

export interface InvocationStatus {
  module: string;
  context: string;
  method: string;
  details?: {
    [key: string]: any;
  };
}
