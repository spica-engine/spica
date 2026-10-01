/**
 * The types of the document CRUD level.
 *
 * Phase 1's rule is zero behaviour change: these aliases take the place of the names that come from
 * `mongodb` today and are **structurally permissive**. The Mongo driver can assign its own types to them
 * and the 127 calling files do not change.
 *
 * The canonical query language is not at this level but at the `Expression` + `ReadPlan` level (K-3). The
 * `DocumentFilter` here is not a contract but a carrier for the existing CRUD calls.
 */
export type DocumentFilter<T = any> = Record<string, any> | Partial<T>;

export type DocumentUpdate<T = any> = Record<string, any> | Partial<T>;

/**
 * The helpers that rewrite the `_id` field.
 *
 * The shape is kept **structurally** identical to the MongoDB driver's counterparts (`EnhancedOmit` plus
 * `_id`). The point is for the `MongoCollection implements ICollection` step to pass without touching the
 * body: the `WithId<T>` the driver returns has to be assignable to the `WithId<T>` here. `_id`'s type is
 * deliberately `any` — id generation lives in the application layer, not in the driver (K-1).
 */
export type EnhancedOmit<T, K> = string extends keyof T
  ? T
  : T extends any
    ? Pick<T, Exclude<keyof T, K>>
    : never;

export type WithId<T> = EnhancedOmit<T, "_id"> & {_id: any};

export type OptionalId<T> = EnhancedOmit<T, "_id"> & {_id?: any};

export type OptionalUnlessRequiredId<T> = T extends {_id: any} ? T : OptionalId<T>;

export interface FindOptions {
  limit?: number;
  skip?: number;
  sort?: SortSpec;
  projection?: Record<string, 0 | 1 | boolean>;
  [option: string]: any;
}

export type SortDirection = 1 | -1;

export type SortSpec = Record<string, SortDirection>;

export enum ReturnDocument {
  BEFORE = "before",
  AFTER = "after"
}

export interface UpdateOptions {
  upsert?: boolean;
  [option: string]: any;
}

export interface FindOneAndUpdateOptions extends UpdateOptions {
  returnDocument?: ReturnDocument | "before" | "after";
  /** Which of the matching documents is taken; both backends honour it. */
  sort?: SortSpec;
  [option: string]: any;
}

export type FindOneAndReplaceOptions = FindOneAndUpdateOptions;
export type FindOneAndDeleteOptions = FindOptions;

export interface CollectionOptions {
  /** The counterpart of `documentSettings.countLimit`; a write is rejected once the limit is exceeded. */
  entryLimit?: number;
  collectionOptions?: Record<string, any>;
  afterInit?: (...args: any[]) => any;
}

export interface CollectionStatus {
  limit: number | undefined;
  current: number;
  unit: string;
}
