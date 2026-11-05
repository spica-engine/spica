import {Id} from "./id.js";

export type ResourceRef = {kind: "collection"; name: string} | {kind: "bucket"; bucketId: string};

export type FilterReplacer = (filter: object) => Promise<object>;

export type WhereCondition =
  | {eq: unknown}
  | {in: unknown[]}
  | {matches: string; caseInsensitive?: boolean};

/**
 * What a caller's policies allow, as data. An empty filter allows everything. Each exclude list
 * belongs to one policy statement and the statements are alternatives of each other, as is include.
 */
export interface ResourceFilterSpec {
  include: string[];
  exclude: string[][];
}

export interface ReadSpec {
  id?: Id;
  resourceFilter?: ResourceFilterSpec;
  /**
   * An object is a MongoDB JSON filter and a string is a Spica expression. Each engine accepts
   * only its own language and answers the other with FilterLanguageError.
   */
  filter?: object | string;
  /**
   * Run on the caller filter before the engine's own id and date replacers.
   */
  filterReplacers?: FilterReplacer[];
  /**
   * Conditions the caller builds itself, unlike filter which comes from client input.
   */
  where?: {[field: string]: WhereCondition};
  createdBetween?: {from: Date; to: Date};
  /**
   * Names the engine resolves per collection. Each engine places them where today's reads do.
   */
  relations?: string[];
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

export interface ShapeOptions {
  locale?: {best: string; fallback: string};
}

export interface ResultShaper {
  shape<I, O = I>(resource: ResourceRef, input: I, options?: ShapeOptions): Promise<O>;
}

export const RESULT_SHAPER = Symbol.for("SPICA_DATA_RESULT_SHAPER");
