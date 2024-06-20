import {ObjectId} from "@spica-server/database";

export interface RefreshToken {
  _id?: ObjectId;
  identity: string;
  token: string;
  created_at: Date;
  expired_at: Date;
}

export interface PaginationResponse<T> {
  meta: {total: number};
  data: T[];
}