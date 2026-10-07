/**
 * The physical naming rules.
 *
 * A single source: the mapper, the DDL planner and the drift check all read from here. The names being
 * deterministic is a precondition of K-12 (intent → derivative) — the same bucket definition always has
 * to produce the same physical names, otherwise the drift check gives false positives.
 */

/** The bucket data tables live in this schema. */
export const BUCKET_SCHEMA = "bucket";
/** The system tables (`buckets`, `identity`, `_changes`, …) live in this schema. */
export const SYSTEM_SCHEMA = "spica";
/** The `onetomany` junction tables live in this schema. */
/**
 * The namespace reserved for relation junction tables.
 *
 * **No table lives here at the moment:** `onetomany` relations moved to an id array column in R93. The
 * namespace is still created, because K-11's four namespaces are a definition of a **privilege boundary**
 * and narrowing that is a separate decision; if a structure that needs a junction table appears, its
 * place is ready.
 */
export const RELATION_SCHEMA = "rel";
/** The functions' own tables live in this schema — DDL privileges exist only here (K-11). */
export const APP_SCHEMA = "app";

/**
 * The table name from a bucket id. It stays the same as the `bucket_<id>` collection name on Mongo, so
 * that a migration tool does not have to guess the mapping.
 */
export function tableName(bucketId: string): string {
  return `bucket_${bucketId}`;
}

/**
 * The column name from a property key.
 *
 * The **key** is used, not the title the user sees; the key is already restricted to
 * `^(?!_id$)[_a-zA-Z][_a-zA-Z0-9]*$` (`bucket.schema.json`), so it is a directly safe identifier. All
 * identifiers are quoted in the produced SQL all the same.
 */
export function columnName(propertyKey: string): string {
  return propertyKey;
}

/**
 * The index name. The existing Mongo behaviour is preserved: the index name in a bucket definition is
 * already produced by `bucket.service.ts:generateIndexName`, and here only the schema prefix is left
 * out — because PostgreSQL index names are unique per database rather than per schema, the table name
 * comes first.
 */
export function indexName(bucketId: string, baseName: string): string {
  return `${tableName(bucketId)}_${baseName}`;
}
