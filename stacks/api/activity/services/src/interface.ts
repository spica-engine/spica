import {ObjectId} from "@spica-server/database";

export interface Activity {
  _id?: ObjectId;
  resource: string[];
  action: Action;
  identifier: string;
}

export interface PreActivity {
  identifier: string;
  action: Action;
}

export interface Predict {
  (preActivity: PreActivity, req: any, res: any): Activity[];
}

export enum Action {
  POST = 1,
  PUT = 2,
  DELETE = 3
}

export interface ActivityOptions {
  expireAfterSeconds: number;
}

export const ACTIVITY_OPTIONS = Symbol.for("ACTIVITY_OPTIONS");
