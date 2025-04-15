import {CollectionOptions, ObjectId} from "mongodb";

export interface InitializeOptions {
  entryLimit?: number;
  collectionOptions?: CollectionOptions;
  afterInit?: (...args: any[]) => any;
}

export type OptionalId<T> = Omit<T, "_id"> & {_id?: ObjectId | string | number};

export interface Document {
  _id: any;
  [index: string]: any;
}
