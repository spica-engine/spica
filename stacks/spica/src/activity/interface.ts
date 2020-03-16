export interface Activity {
  _id?: string;
  user: string;
  module: string;
  action: Actions;
  documentId: string;
  date: Date;
}

export enum Actions {
  INSERT = "Insert",
  UPDATE = "Update",
  DELETE = "Delete"
}

export interface ActivityFilter {
  modules: string[];
  actions: string[];
  date: {
    begin: Date;
    end: Date;
  };
}

export function getAvailableFilters() {
  return {
    actions: [Actions.INSERT, Actions.UPDATE, Actions.DELETE],
    modules: [
      "Bucket",
      "Bucket-Data",
      "Bucket-Settings",
      "Identity",
      "Policy",
      "Apikey",
      "Passport-Settings",
      "Storage",
      "Function"
    ]
  };
}
