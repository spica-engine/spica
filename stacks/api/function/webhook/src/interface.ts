import {ObjectId} from "@spica-server/database";

export interface Webhook {
  _id?: ObjectId;
  url: string;
  trigger: Trigger;
}

export interface Trigger {
  name: "database";
  active?: boolean;
  options: {
    collection: string;
    type: "INSERT" | "UPDATE" | "REPLACE" | "DELETE";
  };
}

export interface Log {
  _id?: ObjectId;
  webhook: string;
  request: Request;
  response: Response;
  executionTime?: Date;
}

export interface Request {
  headers: {
    [key: string]: string;
  };
  path: string;
  body: {
    [key: string]: string;
  };
}

export interface Response {
  status: number;
  statusText: string;
  body: {
    [key: string]: string;
  };
  headers: any[];
}
