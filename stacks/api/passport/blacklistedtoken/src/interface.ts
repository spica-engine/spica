import {ObjectId} from "@spica-server/database";

export interface BlacklistedToken {
  _id?: ObjectId;
  token: string;
  expires_in: Date;
}

export interface PaginationResponse<T> {
  meta: {total: number};
  data: T[];
}