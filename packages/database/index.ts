// This module exports a **closed list**, not `export * from "mongodb"`: the BSON value types come from
// `bson` and only driver-specific classes come from mongodb.
//
// The `bson` version is **pinned to the mongodb driver's major** (`^6.10.4`). A free range installs a
// different major and fails with "Unsupported BSON version".
//
// A known and accepted asymmetry: `bson` loads `lib/bson.node.mjs` under ESM, while mongodb, being CJS,
// loads `lib/bson.cjs`. The same version, two module instances, two `ObjectId` classes. Serialization is
// unaffected (BSON v6 checks `_bsontype`, measured). `instanceof` is one casualty: that is why
// `instanceof ObjectId` was removed from the codebase and `isId()` is used instead — it was necessary,
// because values read from the database are always deserialized with the driver's own copy, and on
// PostgreSQL the codec will produce the application layer's class (a silent difference).
//
// The other casualty is **ordering**. Each instance has its own `PROCESS_UNIQUE` and its own counter, so
// an id generated here and an id the driver generated (an `insertMany` with no `_id`) share only the
// timestamp: inside the same second their relative order is random per process. Sorting by `_id` is only
// an insertion order when every id in the collection came from the same generator.

// BSON value types — independent of the driver
export {ObjectId, Long, Decimal128, Binary, EJSON} from "bson";

// Driver-specific runtime values and enums
export {ReturnDocument, ProfilingLevel, MongoClient, Db, Collection, ChangeStream} from "mongodb";

// The types that come from mongodb
export type {
  Filter,
  UpdateFilter,
  WithId,
  OptionalId,
  OptionalUnlessRequiredId,
  CreateIndexesOptions,
  IndexSpecification,
  Document,
  DeleteResult,
  InsertOneResult
} from "mongodb";

/**
 * The option types come **from the driver contract**.
 *
 * They used to be re-exported from mongodb and they collided once `DatabaseService` became neutral:
 * mongodb's `sort?: Sort` field is not assignable to the contract's `sort?: SortSpec`, and an index
 * signature does not rescue a clash on a named field either. Making the contract the source both removes
 * the error and moves us closer to the criterion that `packages/api` uses contract types only.
 */
export type {
  FindOptions,
  FindOneAndUpdateOptions,
  FindOneAndReplaceOptions,
  FindOneAndDeleteOptions,
  UpdateOptions,
  SortSpec
} from "@spica-server/database-driver";

// Re-exported from the driver contract: the check to be used instead of `instanceof ObjectId`.
export {isId} from "@spica-server/database-driver";

// Index management is a declared, separate capability rather than a mandatory member of the contract:
// the factory asks the driver for it (`ISupportsIndexManager`).
export {toIndexSpec} from "./mongo/src/mongo.index-manager.js";
// the Mongo driver's capability declaration; the contract test and the panel read it.
export {mongoCapabilities} from "./mongo/src/mongo.capabilities.js";
export {getIndexManager} from "./src/index-manager.js";

// Spica's own surface
export {DatabaseModule, backendFromUri} from "./src/database.module.js";
export type {Backend, ConnectionOptions} from "./src/database.module.js";
export {DatabaseService} from "./src/database.service.js";
export {MongoDatabase} from "./mongo/src/mongo.database.js";
// the startup guard against a silent backend switch.
export {guardInstance, InstanceGuardError, INSTANCE_COLLECTION} from "./src/instance-guard.js";
export type {InstanceRecord, InstanceGuardOptions} from "./src/instance-guard.js";
export * from "./src/pipes.js";
export * from "./src/collection.js";
