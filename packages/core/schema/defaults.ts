import {Default, Format} from "@spica-server/core/schema";
import {ObjectId} from "@spica-server/database";

export const CREATED_AT: Default = {
  match: ":created_at",
  type: "date",
  create: (data: string) => {
    return data || new Date().toISOString();
  }
};

export const UPDATED_AT: Default = {
  match: ":updated_at",
  type: "date",
  create: () => {
    return new Date().toISOString();
  }
};
