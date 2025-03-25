import {ObjectId, BaseCollection} from "@spica-server/database";
import {Bucket, BucketPreferences} from "@spica-server/interface/bucket/services";

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

export type FilterReplacer = (
  filter: object,
  bucket: Bucket,
  relationResolver: RelationResolver
) => Promise<object>;

export interface IAuthResolver {
  getProperties(): object;
  resolveRelations(dentity: any, aggregation: object[]): Promise<any>;
}

export interface Locale {
  best: string;
  fallback: string;
}

export const enum RelationType {
  One = "onetoone",
  Many = "onetomany"
}

export interface RelationMap {
  type: RelationType;
  target: string;
  path: string;
  children?: RelationMap[];
  schema: Bucket;
}

export interface RelationMapOptions {
  resolve: RelationResolver;
  paths: string[][];
  properties: object;
}

export interface ResetNonOverlappingPathsOptions {
  left: string[][];
  right: string[][];
  map: RelationMap[];
}

export type RelationDefinition = {
  type: "relation";
  bucketId: string;
  relationType: RelationType;
  dependent: boolean;
};

export type RelationResolver = (id: string) => Promise<Bucket>;

export const AUTH_RESOLVER = Symbol.for("AUTH_RESOLVER");
