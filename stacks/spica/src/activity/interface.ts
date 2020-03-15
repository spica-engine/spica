export interface Activity {
  _id?: string;
  user: string;
  module: string;
  action: Actions;
  srcId: string;
  date: Date;
}

export enum Actions {
  INSERT = "Insert",
  UPDATE = "Update",
  DELETE = "Delete"
}
