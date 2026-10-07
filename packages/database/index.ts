// Phase 1 slice 2 — `export * from "mongodb"` was removed; the surface was reduced to a closed list.
//
// 2a: the list was made explicit (the source was still mongodb).
// 2b: the BSON *value* types moved to `bson`; mongodb was left only for driver-specific classes.
//
// The `bson` version is **pinned to the mongodb driver's major** (`^6.10.4`). With a free range (`"*"`)
// yarn installs a different major and an "Unsupported BSON version" risk appears — measured (R20).
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
// an insertion order when every id in the collection came from the same generator (R129).

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
 * The option types come **from the driver contract** (Phase 6 slice 6a).
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

// Index management. In Phase 6 the factory **asks the driver** (`ISupportsIndexManager`):
// `DatabaseService` now carries a real instance, with no cast, but index management was not made a
// mandatory member because it is a declared, separate capability.
export {toIndexSpec} from "./mongo/src/mongo.index-manager.js";
// K-10: the Mongo driver's capability declaration; the contract test and the panel read it.
export {mongoCapabilities} from "./mongo/src/mongo.capabilities.js";
export {getIndexManager} from "./src/index-manager.js";

// Spica's own surface
export {DatabaseModule, backendFromUri} from "./src/database.module.js";
export type {Backend, ConnectionOptions} from "./src/database.module.js";
export {DatabaseService} from "./src/database.service.js";
// Phase 6: the real Mongo implementation of `DatabaseService`; it replaces the `as DatabaseService` cast of Phases 1–5.
export {MongoDatabase} from "./mongo/src/mongo.database.js";
// K-8: the startup guard against a silent backend switch.
export {guardInstance, InstanceGuardError, INSTANCE_COLLECTION} from "./src/instance-guard.js";
export type {InstanceRecord, InstanceGuardOptions} from "./src/instance-guard.js";
export * from "./src/pipes.js";
export * from "./src/collection.js";
