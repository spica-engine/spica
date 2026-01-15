import {ObjectId} from "@spica-server/database";

export interface Preference {
  _id?: ObjectId;
  scope: string;
  [key: string]: any;
}

export type changeFactory = (previousSchema: object, currentSchema: Object) => Promise<unknown>;

export const BUCKET_LANGUAGE_FINALIZER = Symbol.for("BUCKET_LANGUAGE_FINALIZER");
export const IDENTITY_SETTINGS_FINALIZER = Symbol.for("IDENTITY_SETTINGS_FINALIZER");
export const USER_SETTINGS_FINALIZER = Symbol.for("USER_SETTINGS_FINALIZER");
