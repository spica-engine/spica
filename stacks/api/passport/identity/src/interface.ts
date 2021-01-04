import {ObjectId} from "@spica-server/database";

export interface Identity {
  _id?: ObjectId;
  identifier: string;
  password: string;
  policies: string[];
}

export interface Service {
  $resource: string;
  $format?: string;
  title: string;
  actions: string[];
}

export interface PaginationResponse<T> {
  meta: {total: number};
  data: T[];
}
