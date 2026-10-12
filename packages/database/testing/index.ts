export * from "@spica-server/database";
export {getConnectionUri, start, getDatabaseName} from "./src/start";
// Phase 6 slice 6d: container and database helpers for the PostgreSQL leg.
export {startPostgres, createPostgresDatabase} from "./src/start-postgres.js";
export * from "./src/testing.module";
export {stream} from "./src/watch-shim";
// D9: one neutral API; it falls back to the shim on the Mongo leg and to an instance wrapper on the PG leg.
export {probeWatch} from "./src/watch-probe.js";
export type {WatchProbe} from "./src/watch-probe.js";
// A spec-specific collection created by declaring a shape; one call on both legs.
export {createAdHocCollection} from "./src/ad-hoc-collection.js";
