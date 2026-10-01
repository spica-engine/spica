import {Binary, Decimal128, Long, ObjectId} from "bson";
import {Bucket} from "@spica-server/interface-bucket";
import {tableName} from "./naming.js";

/**
 * The row ↔ document mapper.
 *
 * Two free-form types behave differently, which is why only one of them is tagged: `type: "object"` declares
 * its `properties`, so the conversion is schema-driven and the `jsonb` stays readable and queryable, while
 * `type: "json"` reduces to a free object whose inner types are unknown and can only stay lossless as
 * `{$oid}`/`{$date}`/`{$numberLong}`/`{$numberDecimal}`/`{$binary}`.
 */
export interface RowSet {
  row: Record<string, unknown>;
}

/**
 * `read(plan)` **deviates** the row's shape from the schema in two places, and the codec is produced from
 * the schema: without this a translatable field arrives as plain text and the language-map decoder spreads
 * it into an object character by character.
 */
export interface RowShape {
  /** `localize` was applied: what arrives is one language's plain value, not a language map. */
  localized?: ReadonlySet<string>;
  /** `relations` were resolved: what arrives is the target document itself, not an id. */
  resolved?: ReadonlySet<string>;
}

export interface Codec {
  toRow(document: Record<string, any>): RowSet;
  toDocument(row: Record<string, any>, shape?: RowShape): Record<string, any>;
  /**
   * A stored id → its document representation. Exposed because a row is not the only place an id crosses
   * the boundary: the CDC outbox carries `doc_id` as text and the change payload owes an `Id`.
   */
  decodeId(value: any): any;
}

type Encode = (value: any) => any;
type Decode = (value: any) => any;

interface FieldCodec {
  column: string;
  encode: Encode;
  decode: Decode;
  /** The decoder for a translatable field with its language map stripped; otherwise identical to `decode`. */
  decodeLocalized: Decode;
}

/** Produces the converters from the schema **once**; walking it per document would be per-row latency. */
export interface CodecOptions {
  /** Is the primary key free text? See `TableSpec.idKind`. */
  textId?: boolean;
  /**
   * The `jsonb` column that collects fields with no counterpart in the schema. Without it an undeclared
   * field **silently disappears** on write — and system schemas are hand-written, so they can be
   * incomplete, while some fields are genuinely schemaless (`Preference`'s index signature, the identity
   * fields a tenant adds from the panel).
   *
   * Known fields stay real columns: indexable, typed, with planner statistics. Only the undeclared go here.
   */
  overflow?: string;
}

export function createCodec(bucket: Bucket, options: CodecOptions = {}): Codec {
  // A free-text id skips `encodeId`/`decodeId`, which expect an ObjectId.
  const textId = options.textId === true;
  const bucketId = String(bucket._id);
  const overflow = options.overflow;
  const fields: FieldCodec[] = [];

  for (const [key, raw] of Object.entries(bucket.properties || {})) {
    const property = raw as any;

    const converter = converterFor(property);
    fields.push({
      column: key,
      encode: converter.encode,
      decode: converter.decode,
      decodeLocalized: converter.decodeBase || converter.decode
    });
  }

  return {
    /** Honours `textId`: a free-text primary key is handed back as it is, never forced through `ObjectId`. */
    decodeId(value) {
      if (value === undefined || value === null) return value;
      return textId ? value : decodeId(value);
    },

    toRow(document) {
      const row: Record<string, unknown> = {};

      if (document._id !== undefined) {
        /**
         * `ObjectId` → hex on a free-text id as well.
         *
         * A free-text id column still receives an `ObjectId` when `insertOne` generates one, and without
         * the conversion `pg` serializes it with `JSON.stringify` and writes a **quoted** string.
         */
        row._id = textId ? hexIfObjectId(document._id) : encodeId(document._id);
      }

      for (const field of fields) {
        const value = document[field.column];
        if (value === undefined) continue;
        row[field.column] = value === null ? null : field.encode(value);
      }

      // Undeclared fields go to the overflow column; the known ones were taken above.
      if (overflow) {
        const known = new Set(fields.map(f => f.column));

        const extra: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(document)) {
          if (key === "_id" || known.has(key) || value === undefined) continue;
          extra[key] = value;
        }
        row[overflow] = Object.keys(extra).length ? tag(extra) : null;
      }

      return {row};
    },

    toDocument(row, shape) {
      const document: Record<string, any> = {};

      if (row._id !== undefined && row._id !== null) {
        document._id = textId ? row._id : decodeId(row._id);
      }

      for (const field of fields) {
        const value = row[field.column];
        if (value === undefined) continue;
        /**
         * A `NULL` column → the field is **absent**, not `null`: a relational row carries every column
         * while a document hides the ones it does not have.
         *
         * **A declared limit:** `{a: null}` and `{}` differ in a document store and cannot be told apart
         * in a column without an extra marker. Every `$exists` use in the codebase pairs it with
         * `$ne: null`, so the callers already treat the two as the same.
         */
        if (value === null) continue;
        if (shape?.resolved?.has(field.column)) {
          // When `onetomany` is resolved the value is an **array** of target documents; with `onetoone` a single document.
          document[field.column] = Array.isArray(value)
            ? value.map(decodeResolved)
            : decodeResolved(value);
          continue;
        }
        const decode = shape?.localized?.has(field.column) ? field.decodeLocalized : field.decode;
        document[field.column] = decode(value);
      }

      // The overflow column is spread back onto the top level; the caller does not know it exists.
      if (overflow && row[overflow]) {
        Object.assign(document, row[overflow]);
      }

      return document;
    }
  };
}

// ───────────────────────────────────────────────────────────────── field converters

/**
 * A resolved relation value is the target bucket's `to_jsonb` output. The target's own schema is not
 * available here, so only the id is normalized.
 */
function decodeResolved(value: any): any {
  if (!value || typeof value !== "object") return value;
  if (typeof value._id !== "string") return value;
  return {...value, _id: decodeId(value._id)};
}

function converterFor(property: any): {encode: Encode; decode: Decode; decodeBase?: Decode} {
  // A translatable field: the value is a language map and the inner values have the BASE type.
  if (property.options?.translate) {
    const inner = converterFor({...property, options: {...property.options, translate: false}});
    return {
      encode: map => mapValues(map, v => (v === null ? null : inner.encode(v))),
      decode: map => mapValues(map, v => (v === null ? null : inner.decode(v))),
      // When `localize` has been applied the language map is stripped; the base type's decoder is the right one.
      decodeBase: inner.decode
    };
  }

  switch (property.type) {
    case "string":
    case "textarea":
    case "richtext":
    case "color":
    case "hash":
    case "storage":
      /**
       * An `ObjectId` written to a text column is converted **to hex**. The schema says `string`, but
       * `activity.identifier` carries either an id or a plain user name — and without the conversion `pg`
       * writes a quoted `JSON.stringify` result, which no join over `identity._id` will ever match.
       */
      return {encode: hexIfObjectId, decode: value => value};

    case "number":
    case "boolean":
      return identity;

    case "date":
      return {
        // A `timestamptz` column; the driver takes a `Date` and returns a `Date`.
        encode: value => (value instanceof Date ? value : new Date(value)),
        decode: value => (value instanceof Date ? value : new Date(value))
      };

    case "relation":
      /**
       * `onetomany` is an id **array** column (see `bucketToTable`); `onetoone` a single id. Both are
       * stored as hex and read back as an `ObjectId`.
       */
      if (property.relationType === "onetomany") {
        return {
          encode: value => (Array.isArray(value) ? value.map(encodeId) : value),
          decode: value => (Array.isArray(value) ? value.map(decodeId) : value)
        };
      }
      return {encode: encodeId, decode: decodeId};

    case "multiselect":
      return identity;

    case "array":
      return arrayConverter(property);

    case "object":
      // SCHEMA-DRIVEN: the types of the inner properties are known, no tagging.
      return objectConverter(property.properties || {});

    case "json":
      // SCHEMALESS: tagging, to stay lossless.
      return {encode: tag, decode: untag};

    case "location":
      // A GeoJSON object goes into the `jsonb` as it is.
      return identity;

    case "encrypted":
      // `{encrypted, iv, authTag}` goes into a `jsonb` column as it is.
      return identity;

    default:
      return identity;
  }
}

const identity = {encode: (v: any) => v, decode: (v: any) => v};

function arrayConverter(property: any): {encode: Encode; decode: Decode} {
  const items = Array.isArray(property.items) ? property.items[0] : property.items;
  const itemType = items?.type;

  /**
   * The scalar types that go into a native array. A text array needs the `ObjectId` → hex conversion per
   * element — `function.env_vars` carries `ObjectId[]` — or `pg` writes quoted strings into it.
   */
  if (["string", "textarea", "richtext", "color", "storage", "hash"].includes(itemType)) {
    return {
      encode: value => (value || []).map(hexIfObjectId),
      decode: value => value
    };
  }

  if (itemType === "number") {
    return identity;
  }

  // A `jsonb` array: schema-driven when the element type is known, tagged when it is not.
  if (!items || !itemType) {
    return {
      encode: value => (value || []).map(tag),
      decode: value => (value || []).map(untag)
    };
  }
  const inner = converterFor(items);
  return {
    encode: value => (value || []).map((v: any) => (v === null ? null : inner.encode(v))),
    decode: value => (value || []).map((v: any) => (v === null ? null : inner.decode(v)))
  };
}

function objectConverter(properties: Record<string, any>): {encode: Encode; decode: Decode} {
  const inner = new Map<string, {encode: Encode; decode: Decode}>();
  for (const [key, definition] of Object.entries(properties)) {
    inner.set(key, converterFor(definition));
  }

  const walk = (direction: "encode" | "decode") => (value: any) => {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return value;
    const out: Record<string, any> = {};
    for (const [key, v] of Object.entries(value)) {
      const converter = inner.get(key);
      if (!converter || v === null) {
        // A key that is not in the schema: bucket validation prevents this with
        // `additionalProperties: false`, but it can arrive during a migration — it is carried as it is.
        out[key] = v;
        continue;
      }
      out[key] = converter[direction](v);
    }
    return out;
  };

  return {encode: walk("encode"), decode: walk("decode")};
}

// ──────────────────────────────────────────────────────────────────── ids

/**
 * A text column stores a **hex string**, so an `ObjectId` is converted to one. The same rule holds on the
 * codec's write path, the filter compiler's binding and the update compiler's binding: without it `pg`
 * writes a quoted `JSON.stringify` result and either the write is corrupted or the filter never matches.
 */
export function hexIfObjectId(value: any): any {
  return value && typeof value === "object" && typeof value.toHexString === "function"
    ? value.toHexString()
    : value;
}

function encodeId(value: any): string {
  if (value === null || value === undefined) return value;
  return typeof value === "string" ? value : value.toHexString();
}

function decodeId(value: any): ObjectId {
  return value instanceof ObjectId ? value : new ObjectId(value);
}

// ───────────────────────────────────────────────────────────────── tagging (for `json` only)

/** Tags the values that have no natural counterpart in JSON. */
export function tag(value: any): any {
  if (value === null || value === undefined) return value;
  if (value instanceof Date) return {$date: value.getTime()};
  if (value instanceof ObjectId) return {$oid: value.toHexString()};
  if (value instanceof Long) return {$numberLong: value.toString()};
  if (value instanceof Decimal128) return {$numberDecimal: value.toString()};
  if (value instanceof Binary) return {$binary: Buffer.from(value.buffer).toString("base64")};
  if (Buffer.isBuffer(value)) return {$binary: value.toString("base64")};
  if (Array.isArray(value)) return value.map(tag);
  if (typeof value === "object") return mapValues(value, tag);
  return value;
}

/** The inverse of `tag`. */
export function untag(value: any): any {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(untag);
  if (typeof value !== "object") return value;

  const keys = Object.keys(value);
  if (keys.length === 1) {
    const [key] = keys;
    if (key === "$date") return new Date(value.$date);
    if (key === "$oid") return new ObjectId(value.$oid);
    if (key === "$numberLong") return Long.fromString(value.$numberLong);
    if (key === "$numberDecimal") return Decimal128.fromString(value.$numberDecimal);
    if (key === "$binary") return Buffer.from(value.$binary, "base64");
  }
  return mapValues(value, untag);
}

function mapValues(source: any, fn: (value: any) => any): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [key, value] of Object.entries(source || {})) out[key] = fn(value);
  return out;
}
