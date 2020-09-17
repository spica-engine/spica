export interface Preference {
  _id?: string;
  scope: string;
  [key: string]: any;
}

export const LANGUAGE_CHANGE_UPDATER = Symbol.for("LANGUAGE_CHANGE_UPDATER");

export type LanguageChangeUpdater = (
  previousSchema: object,
  currentSchema: Object
) => Promise<unknown>;
