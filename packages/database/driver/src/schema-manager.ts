/**
 * Schema management. The bucket definition is **the intent** and the table schema **the derivative**; the
 * direction is one-way and the table is never changed by hand.
 */
export type ColumnKind =
  | "text"
  | "number"
  | "boolean"
  | "timestamp"
  | "json"
  | "textArray"
  | "numberArray"
  | "reference"
  | "location"
  | "bytes";

export interface ColumnSpec {
  /** The property key; the physical column name is derived from it. */
  name: string;
  kind: ColumnKind;
  /** `options.translate = true` → the value is a language map. */
  translated?: boolean;
  /** The target collection, for `reference`. */
  target?: string;
  /** `relation.dependent = true` → the row is deleted when the target is. */
  cascadeOnDelete?: boolean;
  /**
   * The column's **key order is meaningful**, so it is `json` and not `jsonb`: `jsonb` sorts keys while
   * normalizing them, and a bucket's `properties` order is what the panel shows as its field order.
   *
   * The cost is that `jsonb_set` needs a `::jsonb → ::json` round trip, which loses the order — accepted
   * because only sub-path writes take it, and those run on a related bucket's deletion.
   */
  orderedJson?: boolean;
}

/** A collection's physical table definition, **derived** from the bucket definition. */
export interface TableSpec {
  /** The table name; `bucket_<id>` for buckets, the collection name itself for system collections. */
  collection: string;
  /** Tenant data is `bucket`, system tables are `spica`; absent means `bucket`. */
  namespace?: string;
  /**
   * The `jsonb` column that collects fields the schema does not declare. System tables only, because their
   * schemas are hand-written and can be incomplete — without it an undeclared field **disappears silently**
   * on write.
   */
  overflowColumn?: string;
  /**
   * `"text"` when the primary key is not an `ObjectId`: `replication`'s free-text ids do not fit in 24
   * characters, and `char(24)` would raise on a long one and silently blank-pad a short one.
   */
  idKind?: "objectId" | "text";
  /** `_id char(24) PRIMARY KEY` is implicit and does not appear in this list. */
  columns: ColumnSpec[];
}

export type SchemaChangeKind = "addColumn" | "dropColumn" | "renameColumn" | "changeColumnType";

export interface SchemaChange {
  kind: SchemaChangeKind;
  column: string;
  /** The new name, for `renameColumn`. */
  to?: string;
  /** The target type, for `addColumn` / `changeColumnType`. */
  spec?: ColumnSpec;
}

export interface SchemaPlan {
  collection: string;
  changes: SchemaChange[];
  /** The statements the driver will produce; recorded for auditability. */
  statements: string[];
  /**
   * Whether the data is **rewritten**, not whether the change is slow: `ALTER COLUMN TYPE` rewrites,
   * `DROP COLUMN` + `ADD COLUMN` only touches the catalog.
   */
  requiresRewrite: boolean;
  /**
   * The row count the long-running decision was made on. An **estimate** on purpose — the check must not
   * itself scan the table. `undefined` means the driver could not read one.
   */
  estimatedRows?: number;
  /**
   * The panel's "this may take a while" signal: the DDL holds `ACCESS EXCLUSIVE`, so writes stay blocked
   * for the whole statement. Separate from `requiresRewrite` because a rewrite of a thousand rows deserves
   * no warning and the same one on a million rows does.
   *
   * An unknown row count counts as large: a needless dialog costs a dialog, a missing one costs an
   * unexplained write freeze.
   */
  longRunning: boolean;
}

export interface SchemaPlanHints {
  /** The renames made in the panel. */
  renames?: {from: string; to: string}[];
  /**
   * On a type change, drop and re-add the column rather than converting it. That is the bucket schema's
   * product rule — a field whose type changes has its **values cleared** — and converting would also raise
   * `22P02` on real data for transitions such as `string → boolean`.
   *
   * The default is `false`: `plan()`'s general contract preserves data, and comparing two `TableSpec`s
   * cannot know whether something should be cleared. The caller declares the intent.
   */
  clearOnTypeChange?: boolean;
}

export interface SchemaDrift {
  collection: string;
  /** Present in the definition, absent from the table. */
  missingColumns: string[];
  /** Present in the table, absent from the definition. */
  unexpectedColumns: string[];
  typeMismatches: {column: string; expected: ColumnKind; actual: string}[];
}

export interface ISchemaManager {
  /** Prepares the physical schema from the bucket definition (idempotent). */
  ensure(spec: TableSpec): Promise<void>;
  /**
   * Turns the difference between two definitions into a DDL plan; it does not run it. `hints.renames` has
   * to come from above: comparing two `TableSpec`s cannot tell a rename from a drop+add, and guessing
   * wrong loses the column's data.
   */
  plan(from: TableSpec, to: TableSpec, hints?: SchemaPlanHints): Promise<SchemaPlan>;
  /**
   * Applies the plan **in a single transaction**. If the lock cannot be taken the plan counts as not
   * applied and the caller gets a clear error.
   */
  apply(plan: SchemaPlan): Promise<void>;
  /** Reports the drift between the intent and the derivative. */
  verify(spec: TableSpec): Promise<SchemaDrift>;
}
