/**
 * The types of the document CRUD level.
 *
 * These aliases take the place of the names that used to come from `mongodb` and are **structurally
 * permissive**, so the Mongo driver can assign its own types to them and no calling file changes.
 *
 * The canonical query language is not at this level but at the `Expression` + `ReadPlan` level. The
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
 * deliberately `any` — id generation lives in the application layer, not in the driver.
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
