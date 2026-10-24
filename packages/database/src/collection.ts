import {ICollection} from "@spica-server/database-driver";
import {InitializeOptions, OptionalId} from "@spica-server/interface-database";
import {DatabaseService} from "./database.service.js";
import {DelegatingCollection} from "./base-collection.js";

export {DelegatingCollection};

/**
 * A backwards-compatible name. `BaseCollection` is used both as a type and as a mixin factory (28 files
 * write `extends BaseCollection<X>("name")`); both are preserved.
 *
 * What changed underneath: it used to derive from `MongoCollection` and now derives from
 * `DelegatingCollection`. Because `extends` is fixed at compile time, a base class bound to Mongo could
 * never be used on PostgreSQL; delegation moves the driver selection to runtime. The 28 services did not
 * change.
 */
export type BaseCollection<T> = DelegatingCollection<T>;

export function BaseCollection<T extends OptionalId<T>>(collection?: string) {
  return class extends DelegatingCollection<T> {
    constructor(db: DatabaseService, options?: InitializeOptions) {
      super(db, collection, options as any);
    }
  };
}

/**
 * The factory that replaces raw `db.collection()` calls.
 *
 * It delegates to the driver: whichever driver was injected, its collection comes back.
 */
export function getCollection<T = any>(
  db: DatabaseService,
  name: string,
  options?: InitializeOptions
): ICollection<T> {
  return db.collection<T>(name, options as any);
}
