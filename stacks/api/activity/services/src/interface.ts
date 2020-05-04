import {ObjectId} from "@spica-server/database";

export interface Activity {
  _id?: ObjectId;
  resource: string[];
  action: Action;
  identifier: string;
}

export interface Predict {
  (action: Action, req: any, data: any): string[];
}

export enum Action {
  POST = 1,
  PUT = 2,
  DELETE = 3
}
