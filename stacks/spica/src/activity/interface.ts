export interface Activity {
  _id?: string;
  identifier: string;
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
  identifier?: string;
  modules?: string[];
  actions?: string[];
  date?: {
    begin: Date;
    end: Date;
  };
  limit?: number;
  skip?: number;
}

export function getAvailableFilters() {
  return {
    identifier: undefined,
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
