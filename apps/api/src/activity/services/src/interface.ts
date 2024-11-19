import {ObjectId} from "@spica/database";

export interface PreActivity {
  identifier: string | ObjectId;
  action: Action;
}

export interface ModuleActivity extends PreActivity {
  resource: string[];
}

export interface Activity extends ModuleActivity {
  _id?: ObjectId;
  created_at: Date;
}

export interface Predict {
  (preActivity: PreActivity, req: any, res: any): ModuleActivity[];
}

export enum Action {
  POST = 1,
  PUT = 2,
  DELETE = 3,
  PATCH = 4
}

export interface ActivityOptions {
  expireAfterSeconds: number;
}

export const ACTIVITY_OPTIONS = Symbol.for("ACTIVITY_OPTIONS");
