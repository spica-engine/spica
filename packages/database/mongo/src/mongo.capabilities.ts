import {DriverCapabilities} from "@spica-server/database-driver";

/**
 * The MongoDB driver's capability declaration.
 *
 * This object is the reference the PostgreSQL driver is compared against: the differences are not silent,
 * they are declared. The panel reads this declaration and hides the interface in question (
 * read-only).
 */
export const mongoCapabilities: DriverCapabilities = {
  backend: "mongodb",
  version: "6.x",

  // A raw Mongo JSON filter is valid here; on PostgreSQL it returns a 400.
  rawMongoFilter: true,
  aggregationPipeline: true,
  queryProfiler: "system.profile",
  nativeTTLIndex: true,
  indexOptions: {sparse: true, collation: true, partial: true},
  directAccessDevkit: "@spica-devkit/database",

  // Relation integrity lives in the application layer: `clearRelations` / `dependent` are run by hand.
  referentialIntegrity: false,

  // The number of fields on a document is unlimited; on PostgreSQL there are ~1600 column slots.
  maxLifetimeFieldsPerCollection: null,

  // Change streams require a replica set — even on a single node it is enabled with `--replSet`.
  requiresReplicaSet: true
};
