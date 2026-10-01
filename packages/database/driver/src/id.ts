import {Binary, Decimal128, Long, ObjectId} from "bson";

/**
 * Spica's document id. Generation stays in the application layer (K-1); it is stored as a BSON ObjectId
 * on MongoDB and as the `char(24)` hex representation of the same value on PostgreSQL.
 */
export type Id = ObjectId;

/** The values with no natural counterpart in JSON that drivers have to recognize at the boundary. */
export type NonJsonValue = ObjectId | Date | Long | Decimal128 | Binary;

/**
 * The row ↔ document mapper (Phase 2). Because a real column carries the type on the column itself, the
 * work done here is narrow: only the values *inside* free-form fields (`type: object | json`) have to be
 * tagged.
 */
export interface DocumentCodec {
  /** Document → the driver's storage representation. */
  encode<T>(document: T): unknown;
  /** The representation the driver stored → a document. */
  decode<T>(stored: unknown): T;
}

/**
 * Says whether a value is a document id.
 *
 * **`instanceof` cannot be used.** The reason was measured: `bson` loads `lib/bson.node.mjs` under ESM
 * while mongodb, being CJS, loads `lib/bson.cjs` — two separate module instances of the same version, so
 * two separate `ObjectId` classes. On top of that, values **read** from the database are always
 * deserialized with the driver's own copy; whichever copy the application layer uses, the two cannot be
 * made to meet.
 *
 * A harder reason: on the PostgreSQL driver the codec will produce ids with the application layer's
 * class, and on Mongo with the driver's. `instanceof` would work on PG and not on Mongo — the silent
 * difference K-10 forbids. A `_bsontype` check gives the same result on both copies (measured).
 */
export function isId(value: unknown): value is Id {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as {_bsontype?: unknown})._bsontype === "ObjectId"
  );
}
