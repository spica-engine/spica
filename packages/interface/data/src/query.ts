import {Id} from "./id.js";

export type ResourceRef = {kind: "collection"; name: string} | {kind: "bucket"; bucketId: string};

export type FilterReplacer = (filter: object) => Promise<object>;

export interface ReadSpec {
  id?: Id;
  resourceFilter?: object;
  filter?: object;
  /**
   * Run on the caller filter before the engine's own id and date replacers.
   */
  filterReplacers?: FilterReplacer[];
  fields?: {[path: string]: 0 | 1};
  sort?: {[path: string]: 1 | -1};
  skip?: number;
  limit?: number;
}

/**
 * "estimate-unless-filtered" counts exactly only when the caller filter narrows the result and
 * estimates the collection size otherwise. "exact" always counts the matching documents.
 */
export type CountStrategy = "estimate-unless-filtered" | "exact";

export interface Page<T> {
  meta: {total: number};
  data: T[];
}

export interface CollectionQueryFacade {
  find<T>(collection: string, spec?: ReadSpec): Promise<T[]>;
  findOne<T>(collection: string, spec: ReadSpec): Promise<T | null>;
  paginate<T>(collection: string, spec: ReadSpec, count: CountStrategy): Promise<Page<T>>;
}

export const COLLECTION_QUERY = Symbol.for("SPICA_DATA_COLLECTION_QUERY");

export interface ResultShaper {
  shape<T>(resource: ResourceRef, result: T): T;
}

export const RESULT_SHAPER = Symbol.for("SPICA_DATA_RESULT_SHAPER");
