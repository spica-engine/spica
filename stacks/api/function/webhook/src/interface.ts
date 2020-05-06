import {ObjectId} from "@spica-server/database";

export interface Webhook {
  _id?: ObjectId;
  url: string;
  body: string;
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
}

export interface Request {
  headers: {
    [key: string]: string;
  };
  url: string;
  body: string;
}

export interface Response {
  status: number;
  statusText: string;
  body: string;
  headers: {
    [key: string]: string[];
  };
}
