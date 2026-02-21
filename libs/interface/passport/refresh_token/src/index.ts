import {ObjectId} from "@spica-server/database";

export interface ClientMeta {
  fingerprint: string;
  device_label?: string;
}

export interface RefreshToken {
  _id?: ObjectId;
  identity?: string;
  user?: string;
  token: string;
  created_at: Date;
  expired_at: Date;
  last_used_at: Date;
  disabled?: boolean;
  client_meta?: ClientMeta;
}

export interface PaginationResponse<T> {
  meta: {total: number};
  data: T[];
}
