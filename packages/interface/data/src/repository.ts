import {ChangeOperation} from "./change-feed.js";

export type RepositoryClass = new (...args: any[]) => unknown;

export type RepositoryClasses = Map<symbol, RepositoryClass>;

export const REPOSITORY_CLASSES = Symbol.for("SPICA_DATA_REPOSITORY_CLASSES");

export interface EntryStatus {
  limit?: number;
  current: number;
  unit: "count";
}

export interface ProfilerQuery {
  filter?: object;
  limit?: number;
  skip?: number;
  sort?: {[key: string]: 1 | -1};
}

export interface CollectionNames {
  /**
   * The collections a database trigger can follow.
   */
  list(): Promise<string[]>;
  /**
   * The operations the change feed reports for them.
   */
  changeOperations(): ChangeOperation[];
}

export const COLLECTION_NAMES = Symbol.for("SPICA_DATA_COLLECTION_NAMES");

export interface DataHealth {
  /**
   * Rejects when the database can not serve requests.
   */
  ping(): Promise<void>;
}

export const DATA_HEALTH = Symbol.for("SPICA_DATA_HEALTH");

export const DATA_ENGINE = Symbol.for("SPICA_DATA_ENGINE");

export const PG_POOL = Symbol.for("SPICA_PG_POOL");
