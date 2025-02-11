export interface Activity {
  _id?: string;
  identifier: string;
  resource: string[];
  action: string;
  created_at: Date;
}

export interface ActivityFilter {
  _id?: string;
  identifier?: string;
  action?: string[];
  resource?: {$all: string[]; $in: string[]};
  date?: {
    begin?: Date;
    end?: Date;
  };
  limit?: number;
  skip?: number;
}
