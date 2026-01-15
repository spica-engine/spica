import {ObjectId, BaseCollection} from "@spica-server/database";
import {Bucket, BucketPreferences} from "@spica-server/interface/bucket";
import {IAuthResolver} from "./auth";

export interface CrudOptions<Paginate> {
  localize?: boolean;
  paginate?: Paginate;
}

export interface CrudParams {
  resourceFilter?: object;
  documentId?: ObjectId;
  filter?: object | string;
  language?: string;
  relationPaths: string[][];
  req: any;
  sort?: object;
  skip?: number;
  limit?: number;
  projectMap: string[][];
  applyAcl?: boolean;
}

export interface CrudFactories<T> {
  collection: (schema: Bucket) => BaseCollection<T>;
  preference: () => Promise<BucketPreferences>;
  schema: (id: string | ObjectId) => Promise<Bucket>;
  authResolver: IAuthResolver;
}

export interface CrudPagination<T> {
  meta: {total: number};
  data: T[];
}
