import {Inject, Injectable, NestMiddleware} from "@nestjs/common";
import type {NextFunction, Request, Response} from "express";
import {HttpTracker} from "./http-tracker.js";
import {HTTP_TRACKER} from "./tokens.js";

@Injectable()
export class HttpTrackerMiddleware implements NestMiddleware {
  constructor(@Inject(HTTP_TRACKER) private tracker: HttpTracker) {}

  use(req: Request, res: Response, next: NextFunction) {
    this.tracker.handler(req, res, next);
  }
}
