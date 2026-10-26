# Part 6: Result shape

## How to use this document

- Plan and implement only this part. Read the code from the parts under "Depends on" on master, along with their "As built" sections. Don't open the other documents in `docs/postgresql/`.
- If this part needs something a merged part doesn't provide, stop and list it under "Requests to other parts" in your plan instead of building it.
- Follow the PR breakdown. Each PR is either a behaviour-neutral refactor or new engine code, never both, and is small enough to review in one sitting.
- Existing MongoDB suites stay green. New code brings its own tests in the PostgreSQL CI job.
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

| Contract                | What later parts expect                                                                                 |
| ----------------------- | ------------------------------------------------------------------------------------------------------- |
| PostgreSQL result shaper | Given a bucket, its main row, child rows, link rows and joined rows, and the requested locale, it returns the document. Bound to the shaper hook on PostgreSQL. |
| Row set format          | The shape that queries (Part 8), writes (Part 9) and change events (Part 10) hand to the shaper.        |

## Not this part

- Fetching rows (Parts 8, 9, 10).
- Id handling (Parts 0, 3).

## Today

- On MongoDB, documents come out already nested, and the shaper hook from Part 0 does nothing.

## Target architecture

### Components

| Component          | Responsibility                                                                                     |
| ------------------ | -------------------------------------------------------------------------------------------------- |
| Row set format     | Describes the main row plus child, link and joined rows grouped by field.                         |
| Result shaper      | Rebuilds the document from a row set using table metadata.                                         |

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

_Fill in after the last PR merges._
