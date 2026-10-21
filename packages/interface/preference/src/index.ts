import {Id} from "@spica-server/interface-data";

export interface Preference {
  _id?: Id;
  scope: string;
  [key: string]: any;
}

export type changeFactory = (previousSchema: object, currentSchema: Object) => Promise<unknown>;

export const BUCKET_LANGUAGE_FINALIZER = Symbol.for("BUCKET_LANGUAGE_FINALIZER");
