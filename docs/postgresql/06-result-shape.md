# Part 6: Result shape

## How to use this document

- Plan and implement only this part. Read the code from the parts under "Depends on" on master, along with their "As built" sections. Don't open the other documents in `docs/postgresql/`.
- If this part needs something a merged part doesn't provide, stop and list it under "Requests to other parts" in your plan instead of building it.
- Follow the PR breakdown. Each PR is either a behaviour-neutral refactor or new engine code, never both, and is small enough to review in one sitting.
- Existing MongoDB suites stay green. New code brings its own tests, which run on PostgreSQL in CI. Shared behaviour uses contract suites.
- After the last PR, fill in "As built".

## Purpose

Turns PostgreSQL rows back into documents with today's structure. Nested objects, arrays, relations and translations sit where clients expect them, and dates serialize the same way. Keys are the exception: on PostgreSQL a bucket document carries the primary key its owner defined, not `_id`.

## Rules that apply

- Same response structure on both engines.
- Keys are engine-native, including their names. System records use `_id` on MongoDB and `id` on PostgreSQL (Part 3). Bucket data uses the bucket's own primary key (Part 5).

## Depends on

- **Part 0 (merged):** the result shaper hook that every facade read and write passes through.
- **Part 5 (merged):** table metadata, which says which table and column holds each field, and primary key metadata.

## Provides

| Contract                 | What later parts expect                                                                                                                                         |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PostgreSQL result shaper | Given a bucket, its main row, child rows, link rows and joined rows, and the requested locale, it returns the document. Bound to the shaper hook on PostgreSQL. |
| Row set format           | The shape that queries (Part 8), writes (Part 9) and change events (Part 10) hand to the shaper.                                                                |

## Not this part

- Fetching rows (Parts 8, 9, 10).
- Id handling (Parts 0, 3).

## Today

- On MongoDB, documents come out already nested, and the shaper hook from Part 0 does nothing.

## Target architecture

### Components

| Component      | Responsibility                                                            |
| -------------- | ------------------------------------------------------------------------- |
| Row set format | Describes the main row plus child, link and joined rows grouped by field. |
| Result shaper  | Rebuilds the document from a row set using table metadata.                |

### Flow

1. A query, write or change event produces a row set.
2. The shaper reads the bucket's table metadata.
3. Columns become fields, child rows become arrays and objects, link and joined rows become relations, and locale rows become translated values.
4. The JSON serializer writes the same shape as on MongoDB.

## What changes

- New shaper, bound on PostgreSQL. Nothing changes on MongoDB.

## PR breakdown

1. Row set format, and shaping for scalar fields and objects stored as columns.
2. Arrays, multiselect and objects stored in child tables.
3. Relations, both resolved and as ids only.
4. Translations, by locale and with all locales.

## Open questions

- None yet.

## Done when

- For every field type, a document written on MongoDB and the same document shaped from PostgreSQL rows serialize identically, apart from the key field. Checked with contract cases.

## As built

### What exists

- **Hook (Part 0 contract widened):** `ResultShaper.shape<I, O = I>(resource, input, options?): Promise<O>`, with `ShapeOptions {locale?: {best, fallback}}` (`packages/interface/data/src/query.ts`). `PassthroughResultShaper` and the MongoDB facades await it; their behaviour is unchanged.
- **Row set format** (`packages/data/postgresql/src/shape/row-set.ts`, exported from `@spica-server/data-postgresql`): `RowSet {main, children?, joined?}`.
  - `main` is the `bucket_<id>` row, keyed by column name.
  - `children` is keyed by property path joined with `.`. It holds the rows of array, multiselect, link and translation tables.
  - `joined` is keyed the same way and holds the resolved target row sets: `RowSet`, `RowSet[]` or `null`. Targets are matched to keys by the target's primary key, so relations inside array items resolve too.
  - Values are as the `pg` driver returns them: `Date`, `{x, y}` for `point`, parsed `jsonb`, `bigint` as string.
- **Shaper** (`src/shape/`):
  - `BucketShaper` is a pure, synchronous core. A chain in `property-shapers.ts` (object, translated, relation, array, scalar) mirrors the metadata collectors.
  - `BucketDescriptions` loads the bucket, its relation targets and the targets of every resolved path, and builds `describeBucket` metadata once per call.
  - `PostgresResultShaper` is bound to `RESULT_SHAPER` on PostgreSQL. It accepts a row set, a list, a page (`{meta, data}`) or `null`, and returns the same container with documents. Collection resources pass through, and empty results load nothing.
- **Relation targets:** `resolveRelationTargets` (`schema/relation-targets.ts`) was extracted from `SchemaPlanner` and is shared with `BucketDescriptions`.

### Rules as built

- The primary key is the property named by `primary`. No `_id` is produced.
- A NULL scalar is `null`. An array without child rows is `[]`. An object whose columns are all NULL is `{}`. An object with some values keeps its keys, with `null` for the NULL ones.
- `bigint` values (keys, properties and array items) are strings.
- A `point` becomes `{type: locationType, coordinates: [x, y]}`.
- A resolved relation becomes the target's document, with the target's own key field and the same locale. A resolved relation without a target is `null`. Unresolved relations are keys; one-to-many keys follow `_position`.
- Translations are `{locale: value}`. With a locale, a top-level translated property becomes `map[best] ?? map[fallback] ?? map`, which is MongoDB's rule. Translated properties inside objects stay maps, as on MongoDB.
- Decryption works on documents, so the query facade decrypts after shaping.

### Differs from MongoDB

- **Order of resolved one-to-many documents:** MongoDB returns them in collection order because of `$lookup`; PostgreSQL returns them in the stored order of the ids.
- **Unset resolved relation:** MongoDB drops the field; PostgreSQL emits `null`.
- **Key order inside a document:** PostgreSQL follows the bucket definition. The contract cases compare parsed JSON, not the serialized string.

### Tests

Unit specs in `packages/data/postgresql/test/shape/` cover each rule with hand-built row sets. `test/shape/database.ts` holds test-only stand-ins for Parts 8 and 9: it writes a document as rows and reads a row set back. `test/contract/result-shape.spec.ts` stores one fixture per field type on both engines and compares them after replacing keys by labels. MongoDB goes through `BUCKET_QUERY`, PostgreSQL through `RESULT_SHAPER`.

### Requests to other parts

- **Part 8:**
  - Deliver row sets in the format above, with `children` for every array, link and translation table of the requested fields and `joined` for resolved relations.
  - Pass `locale` in the options.
  - Decrypt after shaping.
  - Parse `integer` and `bigint` keys from strings.
- **Part 9:** return row sets for written rows so results go through the same shaper.
- **Part 10:** carry row sets in change events. `BucketDescriptions` reads the definitions on every call, so a cache needs invalidation from bucket change events.
