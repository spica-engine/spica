export interface Preference {
  _id?: string;
  scope: string;
  [key: string]: any;
}

export const BUCKET_LANGUAGE_FINALIZER = Symbol.for("BUCKET_LANGUAGE_FINALIZER");
export const IDENTITY_SETTINGS_FINALIZER = Symbol.for("IDENTITY_SETTINGS_FINALIZER");

export type changeFactory = (previousSchema: object, currentSchema: Object) => Promise<unknown>;
