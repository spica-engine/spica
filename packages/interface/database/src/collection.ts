// `bson`, not `mongodb` — the rationale is in `realtime.ts`.
import {ObjectId} from "bson";

export interface InitializeOptions {
  entryLimit?: number;
  /**
   * Options handed to `createCollection`. Backend-specific by nature — a document store's options have no
   * counterpart in a relational one — so the contract carries them opaquely rather than in the Mongo
   * driver's `CreateCollectionOptions`. `IDatabase.createCollection` takes the same shape.
   */
  collectionOptions?: Record<string, any>;
  afterInit?: (...args: any[]) => any;
}

export type OptionalId<T> = Omit<T, "_id"> & {_id?: ObjectId | string | number};

export interface Document {
  _id: any;
  [index: string]: any;
}
