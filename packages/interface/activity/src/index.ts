import {DeletableById, Id} from "@spica-server/interface-data";

export interface PreActivity {
  action: Action;
  identifier?: string | Id;
  username?: string | Id;
}

export interface ModuleActivity extends PreActivity {
  resource: string[];
}

export interface Activity extends ModuleActivity {
  _id?: Id;
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

export interface ActivityRepository extends DeletableById {
  insertMany(activities: Activity[]): Promise<Id[]>;
  deleteByIds(ids: Id[]): Promise<number>;
}

export const ACTIVITY_REPOSITORY = Symbol.for("ACTIVITY_REPOSITORY");
