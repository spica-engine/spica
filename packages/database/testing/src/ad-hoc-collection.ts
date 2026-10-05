import {DatabaseService} from "@spica-server/database";
import {bucketToTable} from "@spica-server/database-postgres";

/**
 * Creates a spec-specific, non-bucket collection.
 *
 * **Why it is needed.** MongoDB can watch a namespace that does not exist and creates it itself on the
 * first write; in a relational model there has to be a table to watch. `DatabaseEnqueuer`'s spec
 * subscribed to a collection called `test_collection` that had never been created, and on PG the driver
 * rejected that loudly — the right behaviour: in production a function's database trigger only
 * targets collections that **exist**, and the panel lists those.
 *
 * Declaring a shape is unavoidable too: on PostgreSQL neither a row can be converted nor a filter
 * compiled without knowing the column types. On the Mongo leg the shape is ignored, so a spec works on
 * both backends with a single call and does not need to know which one it is on.
 */
export async function createAdHocCollection(
  database: DatabaseService,
  name: string,
  properties: Record<string, {type: string; options?: Record<string, unknown>}> = {}
): Promise<void> {
  if (database.capabilities.backend !== "postgres") {
    await database.createCollection(name);
    return;
  }

  const schema = {_id: name, title: name, properties} as any;

  /**
   * The table name comes from the **caller**, not from the schema: `bucketToTable` derives it as
   * `bucket_<id>` and the name wanted here is the collection's own. No `namespace` is given, so the table
   * lives in the same schema as bucket data — and the CDC triggers are attached there too.
   */
  const table = {...bucketToTable(schema), collection: name};

  await database.createCollection(name, {table, schema});
}
