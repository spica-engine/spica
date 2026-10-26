import {Id} from "@spica-server/interface-data";

export interface Preference {
  _id?: Id;
  scope: string;
  [key: string]: any;
}

export type changeFactory = (previousSchema: object, currentSchema: Object) => Promise<unknown>;

export const BUCKET_LANGUAGE_FINALIZER = Symbol.for("BUCKET_LANGUAGE_FINALIZER");

export interface PreferenceRepository {
  findById(id: Id): Promise<Preference | null>;
  findByScope(scope: string): Promise<Preference | null>;
  insert(preference: Preference): Promise<Preference>;
  /**
   * Replaces the scope's preference, inserting it when missing, and resolves to the stored one.
   */
  replaceByScope(scope: string, preference: Preference): Promise<Preference>;
}

export const PREFERENCE_REPOSITORY = Symbol.for("PREFERENCE_REPOSITORY");
