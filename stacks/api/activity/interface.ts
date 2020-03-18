export interface Activity {
  module: string;
  action: Action;
  identifier: string;
  documentId: string;
  date: Date;
}

export enum Action {
  POST = "INSERT",
  PUT = "UPDATE",
  DELETE = "DELETE"
}
