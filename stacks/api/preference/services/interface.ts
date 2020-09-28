export interface Preference {
  _id?: string;
  scope: string;
  [key: string]: any;
}

export const PREFERENCE_CHANGE_FINALIZER = Symbol.for("PREFERENCE_CHANGE_FINALIZER");

export type LanguageChangeUpdater = (
  previousSchema: object,
  currentSchema: Object
) => Promise<unknown>;
