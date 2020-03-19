export interface Activity {
  resource: string[];
  verb: Action;
  identifier: string;
}

export interface Predict {
  (module: string, activity: Activity, req: object, data: object): Activity;
}

export enum Action {
  POST = "INSERT",
  PUT = "UPDATE",
  DELETE = "DELETE"
}
