import {ObjectId} from "bson";
import {Bucket} from "@spica-server/interface-bucket";

/**
 * Reports whether a Mongo document fits the target relational schema.
 *
 * Why it is needed: MongoDB does not enforce a schema, PostgreSQL does. A bucket collection today **can**
 * contain a document that does not match the schema — for example when a field was later changed to `number`
 * and the old text values were not `$unset`, or when it was written through raw `@spica-devkit/database`
 * access. Those produce an `INSERT` error during a migration.
 *
 * This function **fixes nothing and raises nothing**; it only returns the findings. A `--dry-run`
 * report will use it: before migrating, the user should be able to see what will be lost.
 */
export type MismatchKind =
  | "unknownField"
  | "typeMismatch"
  | "nonObjectIdId"
  | "invalidReference"
  | "nonObjectRelationList";

export interface Mismatch {
  kind: MismatchKind;
  /** The path inside the document, such as `meta.at`. */
  path: string;
  /** The type the schema expects (when there is one). */
  expected?: string;
  /** The observed type of the value that was found. */
  found?: string;
  /** What will happen to this value during the migration. */
  consequence: string;
}

export function inspectDocument(bucket: Bucket, document: Record<string, any>): Mismatch[] {
  const mismatches: Mismatch[] = [];
  const properties = (bucket.properties || {}) as Record<string, any>;

  if (document._id !== undefined && !(document._id instanceof ObjectId)) {
    mismatches.push({
      kind: "nonObjectIdId",
      path: "_id",
      expected: "ObjectId",
      found: observedType(document._id),
      consequence: "The row cannot be written because `_id` is char(24); the document is skipped."
    });
  }

  for (const [key, value] of Object.entries(document)) {
    if (key === "_id") continue;

    const property = properties[key];
    if (!property) {
      mismatches.push({
        kind: "unknownField",
        path: key,
        found: observedType(value),
        consequence:
          "It has no counterpart in the schema; with no column, the value is not migrated."
      });
      continue;
    }

    mismatches.push(...inspectValue(key, value, property));
  }

  return mismatches;
}

function inspectValue(path: string, value: any, property: any): Mismatch[] {
  if (value === null || value === undefined) return [];

  // A translatable field: the value is a language map and the inner values have the base type.
  if (property.options?.translate) {
    if (!isPlainObject(value)) {
      return [
        {
          kind: "typeMismatch",
          path,
          expected: "language map (object)",
          found: observedType(value),
          consequence:
            "A translatable field expects a `jsonb` language map; the value is not migrated."
        }
      ];
    }
    const base = {...property, options: {...property.options, translate: false}};
    return Object.entries(value).flatMap(([language, inner]) =>
      inspectValue(`${path}.${language}`, inner, base)
    );
  }

  switch (property.type) {
    case "string":
    case "textarea":
    case "richtext":
    case "color":
    case "hash":
    case "storage":
      return expect(path, value, "string", typeof value === "string");

    case "number":
      return expect(path, value, "number", typeof value === "number");

    case "boolean":
      return expect(path, value, "boolean", typeof value === "boolean");

    case "date":
      return expect(path, value, "Date", value instanceof Date);

    case "multiselect":
      return expect(
        path,
        value,
        "string[]",
        Array.isArray(value) && value.every(v => typeof v === "string")
      );

    case "array":
      return Array.isArray(value) ? [] : expect(path, value, "array", false);

    case "object":
    case "json":
      return isPlainObject(value) ? [] : expect(path, value, "object", false);

    case "location":
      return isPlainObject(value) ? [] : expect(path, value, "GeoJSON object", false);

    case "encrypted":
      return [];

    case "relation":
      return inspectRelation(path, value, property);

    default:
      return [];
  }
}

function inspectRelation(path: string, value: any, property: any): Mismatch[] {
  const isId = (v: any) => v instanceof ObjectId || (typeof v === "string" && ObjectId.isValid(v));

  if (property.relationType === "onetomany") {
    if (!Array.isArray(value)) {
      return [
        {
          kind: "nonObjectRelationList",
          path,
          expected: "an array of ids",
          found: observedType(value),
          consequence:
            "`onetomany` is written to a junction table; a non-array value is not migrated."
        }
      ];
    }
    return value.flatMap((v, i) =>
      isId(v)
        ? []
        : [
            {
              kind: "invalidReference" as const,
              path: `${path}[${i}]`,
              expected: "ObjectId",
              found: observedType(v),
              consequence:
                "The junction table has an FK constraint; the row of an invalid reference cannot be written."
            }
          ]
    );
  }

  return isId(value)
    ? []
    : [
        {
          kind: "invalidReference",
          path,
          expected: "ObjectId",
          found: observedType(value),
          consequence:
            "The column has an FK constraint; the row of an invalid reference cannot be written."
        }
      ];
}

function expect(path: string, value: any, expected: string, ok: boolean): Mismatch[] {
  return ok
    ? []
    : [
        {
          kind: "typeMismatch",
          path,
          expected,
          found: observedType(value),
          consequence: `The column type expects '${expected}'; the value is not migrated.`
        }
      ];
}

function observedType(value: any): string {
  if (value === null) return "null";
  if (value instanceof ObjectId) return "ObjectId";
  if (value instanceof Date) return "Date";
  if (Buffer.isBuffer(value)) return "Buffer";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

function isPlainObject(value: any): boolean {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
