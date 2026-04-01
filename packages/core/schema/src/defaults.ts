import {Default} from "@spica-server/interface/core";

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
  create: (data: string) => {
    return data || new Date().toISOString();
  }
};
