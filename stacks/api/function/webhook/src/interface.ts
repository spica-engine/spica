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
