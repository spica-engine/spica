import {
  IIndexManager,
  ISupportsIndexManager,
  UnsupportedCapabilityError
} from "@spica-server/database-driver";
import {DatabaseService} from "./database.service.js";

/**
 * The factory that replaces raw `collection.listIndexes()` / `createIndex()` / `dropIndex()` calls.
 *
 * It is a matter of **asking the driver**: index management is a separate capability
 * declared with `ISupportsIndexManager`, not a mandatory part of `DatabaseService`. On a driver that does
 * not provide it, it raises a declared error instead of silently pretending to work.
 */
export function getIndexManager(db: DatabaseService, collection: string): IIndexManager {
  const driver = db as unknown as Partial<ISupportsIndexManager>;
  if (typeof driver.indexes !== "function") {
    throw new UnsupportedCapabilityError("indexes()", db.capabilities.backend);
  }
  return driver.indexes(collection);
}
