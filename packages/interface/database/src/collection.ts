import {CreateCollectionOptions} from "mongodb";
import {Id} from "@spica-server/interface-data";

export interface InitializeOptions {
  entryLimit?: number;
  collectionOptions?: CreateCollectionOptions;
  afterInit?: (...args: any[]) => any;
}

export type OptionalId<T> = Omit<T, "_id"> & {_id?: Id | string | number};

export interface Document {
  _id: any;
  [index: string]: any;
}
