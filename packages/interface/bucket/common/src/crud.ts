import {BaseCollection} from "@spica-server/database";
import {Id} from "@spica-server/interface-data";
import {Bucket, BucketPreferences} from "@spica-server/interface-bucket";

export interface CrudOptions<Paginate> {
  localize?: boolean;
  paginate?: Paginate;
}

export interface CrudParams {
  resourceFilter?: object;
  documentId?: Id;
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
  schema: (id: string | Id) => Promise<Bucket> | Bucket;
}

export interface CrudPagination<T> {
  meta: {total: number};
  data: T[];
}
