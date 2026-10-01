import {ColumnKind, ColumnSpec, TableSpec} from "@spica-server/database-driver";
import {Bucket} from "@spica-server/interface-bucket";
import {columnName, tableName} from "./naming.js";

/**
 * Produces the physical table definition from a bucket definition.
 *
 * **Pure and deterministic:** the same definition always produces the same `TableSpec`, which the drift check
 * rests on. `_id char(24) PRIMARY KEY` is implicit and does not appear in `columns`.
 */
export function bucketToTable(bucket: Bucket): TableSpec {
  const bucketId = String(bucket._id);
  const columns: ColumnSpec[] = [];

  for (const [key, definition] of Object.entries(bucket.properties || {})) {
    const property = definition as PropertyDefinition;

    columns.push(toColumn(key, property));
  }

  return {collection: tableName(bucketId), columns};
}

interface PropertyDefinition {
  type: string;
  items?: {type?: string} | {type?: string}[];
  bucketId?: string;
  relationType?: "onetoone" | "onetomany";
  dependent?: boolean;
  locationType?: string;
  options?: {translate?: boolean; history?: boolean};
  acl?: string;
}

function toColumn(key: string, property: PropertyDefinition): ColumnSpec {
  const column: ColumnSpec = {
    name: columnName(key),
    kind: toColumnKind(property)
  };

  /**
   * A translatable field's value is a language map, so whatever its base type the column is `jsonb`. A column
   * per language would mean DDL on every bucket table whenever one is added.
   */
  if (property.options?.translate) {
    column.kind = "json";
    column.translated = true;
  }

  /**
   * `onetomany` is an **id array column** (`char(24)[]`), not a junction table.
   *
   * A junction table cannot express a distinction a document store makes: "never written" and "emptied" are
   * different things there, and in a junction table both are zero rows. A nullable array column carries all
   * three — `NULL` is absent, `{}` is empty, and the element order is the column's own.
   *
   * No integrity is lost that MongoDB had: there is no constraint there either, and relation cleanup lives in
   * the application layer.
   */
  if (property.type === "relation" && property.relationType === "onetomany") {
    column.kind = "textArray";
    if (property.bucketId) {
      // No FK is produced (they are produced on `reference` columns only); the target is carried for **resolution**.
      column.target = tableName(property.bucketId);
    }
    column.cascadeOnDelete = property.dependent === true;
    return column;
  }

  if (property.type === "relation" && property.relationType === "onetoone") {
    /**
     * Without a `bucketId`, **no foreign key is produced** and the column carries an id only: a target
     * resolved at runtime (`identity` **or** `user`) has no single table to point at, while `char(24)` plus the
     * codec's id conversion is still the right representation.
     */
    if (property.bucketId) {
      column.target = tableName(property.bucketId);
    }
    column.cascadeOnDelete = property.dependent === true;
  }

  return column;
}

function toColumnKind(property: PropertyDefinition): ColumnKind {
  switch (property.type) {
    case "string":
    case "textarea":
    case "richtext":
    case "color":
    case "hash":
      return "text";

    case "number":
      return "number";

    case "boolean":
      return "boolean";

    case "date":
      return "timestamp";

    // Free-form fields. The type tagging problem stays INSIDE these only: on real
    // columns the type is carried by the column itself.
    case "object":
    case "json":
      return "json";

    case "multiselect":
      return "textArray";

    case "array":
      return arrayKind(property);

    case "relation":
      // Only `onetoone` lands here; `onetomany` went to the junction table.
      return "reference";

    // The id of the stored object. An FK to the `storage` table will be considered in the next step —
    // for now it matches the behaviour on Mongo: free text.
    case "storage":
      return "text";

    case "location":
      // PostGIS is not mandatory, because there is no geo query in the codebase at all (measured).
      return "location";

    case "encrypted":
      /**
       * `jsonb`, NOT `bytea`.
       *
       * My first mapping said "the driver only carries the bytes" and that was wrong: an encrypted value
       * is an **object** shaped `{encrypted, iv, authTag}` (`BaseEncryptedData`), not raw bytes. The
       * codec tried `Buffer.from(object)` and blew up with
       * `The first argument must be of type string or an instance of Buffer…`, so nothing could be
       * written to any bucket that had an encrypted field.
       *
       * Encryption and decryption stay in the application layer — the only thing that changes here is
       * the envelope's physical type.
       */
      return "json";

    default:
      throw new UnknownPropertyTypeError(property.type);
  }
}

/**
 * A native PostgreSQL array when the array's element type is scalar, `jsonb` otherwise.
 *
 * A native array is preferred because it can be indexed with `@>` (GIN) and the expression
 * `"x" in tags` compiles directly to `tags @> ARRAY['x']` (measured in step S). There is no counterpart
 * for arrays of objects.
 */
function arrayKind(property: PropertyDefinition): ColumnKind {
  const items = Array.isArray(property.items) ? property.items[0] : property.items;
  switch (items?.type) {
    case "string":
    case "textarea":
    case "richtext":
    case "color":
    case "storage":
    case "hash":
      return "textArray";
    case "number":
      return "numberArray";
    default:
      // Arrays of dates or booleans, arrays of objects, nested arrays and untyped arrays → jsonb.
      // `date[]`/`boolean[]` do have native counterparts but are deliberately out of scope: we do not
      // multiply column types without measuring their use in the codebase (the overengineering
      // guardrail).
      return "json";
  }
}

export class UnknownPropertyTypeError extends Error {
  readonly code = "UNKNOWN_PROPERTY_TYPE";
  constructor(readonly propertyType: string) {
    super(
      `'${propertyType}' is not a known bucket property type; it has no physical column mapping.`
    );
    this.name = "UnknownPropertyTypeError";
  }
}
