import {Id} from "@spica-server/interface-data";

export interface RefreshToken {
  _id?: Id;
  identity?: string;
  user?: string;
  token: string;
  created_at: Date;
  expired_at: Date;
  last_used_at: Date;
  disabled?: boolean;
}

export interface PaginationResponse<T> {
  meta: {total: number};
  data: T[];
}
