export interface Activity {
  _id?: string;
  identifier: string;
  resource: Resource;
  action: string;
}

export interface Resource {
  name: string;
  documentId: string[];
  subResource?: Resource;
}

export interface ActivityFilter {
  _id?: string;
  identifier?: string;
  action?: string;
  resource?: Resource;
  date?: {
    begin?: Date;
    end?: Date;
  };
  limit?: number;
  skip?: number;
}

export function getAvailableFilters() {
  return {
    actions: ["INSERT", "UPDATE", "DELETE"],
    modules: [
      "Bucket-Data",
      "Bucket",
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
