export interface Activity {
  resource: Resource;
  action: Action;
  identifier: string;
}

export interface Resource {
  moduleName: string;
  moduleId?: string;
  documentId: string[];
}

export interface ControllerDetails {
  moduleName: string;
  documentIdKey: string;
  moduleIdKey?: string;
}

export interface Predict {
  (module: string, activity: Activity, req: object, data: object): Activity;
}

export enum Action {
  POST = "INSERT",
  PUT = "UPDATE",
  DELETE = "DELETE"
}
