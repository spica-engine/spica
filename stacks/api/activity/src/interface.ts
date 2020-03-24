export interface Activity {
  resource: Resource;
  action: Action;
  identifier: string;
}

export interface Resource {
  name: string;
  documentId: string[];
  subResource?: Resource;
}

export interface Predict {
  (action: Action, req: any, data: any): Resource;
}

export enum Action {
  POST = "INSERT",
  PUT = "UPDATE",
  DELETE = "DELETE"
}
