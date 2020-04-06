export interface Activity {
  _id?: string;
  identifier: string;
  resource: Resource;
  action: string;
}

export interface Resource {
  name: string;
  documentId: string[];
}

export interface ActivityFilter {
  _id?: string;
  identifier?: string;
  action?: string[];
  resource?: Resource;
  date?: {
    begin?: Date;
    end?: Date;
  };
  limit?: number;
  skip?: number;
}
