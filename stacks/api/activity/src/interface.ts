import {ObjectId} from "@spica-server/database";

export interface Activity {
  resource: Resource;
  action: Action;
  identifier: string;
}

export interface ActivityQuery {
  _id: ObjectId;
  resource?: Resource;
  action?: Action;
  identifier?: string;
}

export interface Resource {
  name: string;
  documentId: string[];
}

export interface Predict {
  (action: Action, req: any, data: any): Resource;
}

export enum Action {
  POST = 1,
  PUT = 2,
  DELETE = 3
}
