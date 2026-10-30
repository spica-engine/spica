# Part 5: Bucket data schemas

## How to use this document

- Plan and implement only this part. Read the code from the parts under "Depends on" on master, along with their "As built" sections. Don't open the other documents in `docs/postgresql/`.
- If this part needs something a merged part doesn't provide, stop and list it under "Requests to other parts" in your plan instead of building it.
- Follow the PR breakdown. Each PR is either a behaviour-neutral refactor or new engine code, never both, and is small enough to review in one sitting.
- Existing MongoDB suites stay green. New code brings its own tests, which run on PostgreSQL in CI. Shared behaviour uses contract suites.
- After the last PR, fill in "As built".

## Purpose

Turns a bucket definition into real tables, columns, constraints and indexes, and keeps them in step whenever a user creates, edits or deletes a bucket. It runs while the server is live, with no deploy.

## Rules that apply

- Real tables for bucket data. No JSON columns stand in for structure.
- Every edit runs online, however long it takes. None are refused, and the user is responsible for their edits, as on MongoDB today. There is no confirmation step.
- A bucket definition and its tables commit together. If the DDL fails, the old bucket stays as it was.
- Schema validation stays where it is, between the controller and the service.
- Two different primary keys. System tables such as `buckets` keep their own fixed `id uuid` key (Part 3), so bucket ids are uuids and stable. The table that holds a bucket's data has the key its owner picks: `primary` names the property, that property's type (`uuid`, `integer`, `bigint` or `string`) is the key type, and `options.generated` says whether it's generated. This is entirely up to the user, and `primary` is required on PostgreSQL. On MongoDB, `primary` stays the display property and buckets keep `_id` as today.

## Depends on

- **Part 0 (merged):** the engine-aware id type.
- **Part 3 (merged):** the bucket definition repository, the in-house ORM's shared transactions, and PostgreSQL ids.

## Provides

| Contract             | What later parts expect                                                                                                                                                                        |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Schema manager       | Called by `BucketService` on create, update and delete. It owns bucket structure on the running engine.                                                                                        |
| Table metadata       | For any bucket, the names of its main table, child tables, link tables and columns, and which field maps to which. Used by queries, writes, result shaping, ACL, change events and the devkit. |
| Field mapping        | The rules from bucket field types to PostgreSQL structure.                                                                                                                                     |
| Primary key metadata | For any bucket, its primary key field, type and generation. Used to address records, render ACL, build relations, shape results, carry change events and expose keys in the devkit.            |

## Not this part

- Reading rows (Part 8) or writing them (Part 9).
- Turning rows back into documents (Part 6).
- Row triggers for change events (Part 10). Leave a clear place in the DDL plan for them.
- Expression or ACL compilation (Part 7).

## Today

1. A panel user edits a bucket.
2. `BucketController` validates the definition.
3. `BucketService` saves it through the bucket definition repository.
4. On MongoDB, the data lives in a `bucket_<id>` collection, created on the first write, with no stored structure.
5. Schema changes reach caches, validators, GraphQL and realtime through the change feed.

## Target architecture

### Components

| Component          | Responsibility                                                                                                                                                                                                                                                                             |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Schema manager     | The entry point for structure changes, with a MongoDB and a PostgreSQL implementation.                                                                                                                                                                                                     |
| MongoDB side       | Doesn't change structure. It only manages indexes, as today.                                                                                                                                                                                                                               |
| Schema diff        | Engine-neutral. It compares the old and new definitions and lists added, removed, renamed and retyped fields, plus relation and index changes.                                                                                                                                             |
| Naming             | A pure function of the bucket id and the property paths, within PostgreSQL's 63 byte identifier limit. See "Naming".                                                                                                                                                                       |
| Field mapping      | Decides the tables, columns and constraints for each field type.                                                                                                                                                                                                                           |
| Primary key        | The `primary` property on PostgreSQL. Its type gives the key type and `options.generated` the generation. The DDL plan creates it, and foreign keys and link tables use its type.                                                                                                          |
| Bucket schemas     | A common bucket JSON schema with hooks, and an extension per engine that fills them (MongoDB: today's values; PostgreSQL: uuid ids, `uuid`/`integer`/`bigint` types, `options.generated`, restrictions). Each adapter provides its extension and the bucket module composes it at startup. |
| DDL plan           | Ordered structure changes for a diff, including data rewrites when a field's type changes.                                                                                                                                                                                                 |
| Transaction runner | Runs the plan and saves the definition in one transaction.                                                                                                                                                                                                                                 |

### Naming

Names are a pure function of the bucket id and the property paths. Nothing is stored, so the table metadata is always `describeBucket(bucketId, definition)`.

- Every identifier is quoted, so names are case sensitive and reserved words are fine.
- Main table `bucket_<id>`, like MongoDB's `bucket_<id>` (43 bytes for a uuid id). Columns are the property path joined with `__` (`address__geo__lat`). Child, link and translation tables are `bucket_<id>__<path>`. Constraints and indexes are `<table>_<columns>_<kind>` with kind `pk`, `fk`, `uq`, `ck` or `ix` (`_desc` after a descending column).
- A name over 63 bytes keeps its first 54 bytes, then `_` and the first 8 hex characters of the SHA-256 of the full logical name. Because the main table already takes 43 bytes, child tables, constraints and indexes are usually shortened. Code never parses names; it goes through the metadata.
- Two generated names that collide in their scope (columns per table, everything else per schema), such as the properties `a__b` and `a.b`, are rejected with a 400, never renamed silently.
- `_parent`, `_position`, `_locale`, `_value`, `_source` and `_target` are reserved as property names on PostgreSQL.

### Field mapping (as built)

| Bucket field                                                | Becomes on PostgreSQL                                                                                                                                                   |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| string, textarea, richtext, color, storage, hash, encrypted | `text` column                                                                                                                                                           |
| number, boolean, date, json                                 | `double precision`, `boolean`, `timestamptz`, `jsonb` columns                                                                                                           |
| object                                                      | Prefixed columns of the table it sits in, at any depth; without `properties`, one `jsonb` column                                                                        |
| array, multiselect                                          | Child table `(_parent, _position, _value)`, or the item object's fields as columns; cascading foreign key to the parent. An array without `items` is one `jsonb` column |
| relation one-to-one                                         | Foreign key column typed after the target's primary key; `ON DELETE SET NULL`, or `RESTRICT` when required                                                              |
| relation one-to-many                                        | Link table `(_parent, _position, _target)`; both sides cascade                                                                                                          |
| translated scalar                                           | Table `(_parent, _locale, _value)`, one row per parent and locale                                                                                                       |
| location                                                    | `point` column (longitude, latitude); `2dsphere` index becomes a `gist` index, no extension                                                                             |
| required, enum, unique, index                               | `NOT NULL`, `CHECK ... IN`, unique and ordinary indexes (`1`/`-1` only)                                                                                                 |
| primary property (user-chosen)                              | Primary key on the `primary` property; `uuid`, `integer`, `bigint` or `string` (`text`); `DEFAULT uuidv7()` or an identity when `options.generated`                     |

Not supported on PostgreSQL yet: arrays inside array items, a onetomany relation or a translated property inside an array item, an array of relations, translated objects and arrays, indexes on translated properties, compound or unique spatial indexes, and index options other than `unique`, `sparse` and `background` (so no `expireAfterSeconds`).

### Flow

1. A panel user creates or edits a bucket.
2. `BucketController` validates the definition.
3. `BucketService` hands the old and new definitions to the schema manager.
4. The schema diff lists the changes.
5. On MongoDB, index changes are applied, as today.
6. On PostgreSQL, the field mapping and DDL plan produce the structure changes. They run in one transaction with saving the definition.

## What changes

- **`BucketService`:** calls the schema manager.
- **Deleting a bucket on PostgreSQL:** drops its tables, its child tables and every link table that points at it.
- **Relations between buckets:** become foreign keys and link tables, typed by the target bucket's primary key. Deleting or renaming a related bucket updates them.
- **Bucket definition schema:** one JSON schema per engine over a common base. PostgreSQL adds the `uuid`, `integer` and `bigint` property types and `options.generated`, requires `primary`, and restricts what its storage cannot hold.
- **Panel bucket editor:** creates new buckets on PostgreSQL with a generated uuid `id` key. Choosing the key's property, type and generation in the editor is a later panel change.

## PR breakdown

1. Schema manager contract with the MongoDB implementation wrapping today's index handling. This is a behaviour-neutral refactor.
2. Schema diff: engine-neutral, with unit tests only.
3. Naming and table metadata, with the key derived from `primary`.
4. PostgreSQL DDL plan and transaction runner for scalar fields, constraints and the primary key, wired into `BucketService`.
5. Objects, arrays and multiselect.
6. Relations: foreign keys, link tables, cleanup on bucket delete.
7. Translated fields.
8. Location fields.
9. Type changes that rewrite existing rows, including primary key changes and the foreign keys that follow them.
10. Panel: new buckets get an id key.

A bucket schema per engine (the common base, the MongoDB and PostgreSQL extensions, loading by engine) was added first, as its own PR.

## Decisions on the open questions

- Object fields are always prefixed columns. A one-to-one child table for deeper objects would need composite foreign keys inside array items, and flattening needs no joins. The cost is that a missing object and an object with every field null are the same row, which Part 6 has to account for.
- Location is a `point` column; no PostGIS. Spherical distance is a query concern for Part 8.
- Primary keys are single column: a `uuid` property (generated with `uuidv7()`), an `integer` or `bigint` property (identity), or a `string` property (stored as `text`, never generated). Composite keys are not offered.
- Validation is JSON schema, as on MongoDB. What the schema cannot express (the cross-field rules of the key) is a keyword shipped with the PostgreSQL extension; what depends on the database (relation targets, DDL) stays in the manager's transaction.
- A bucket saved without `primary` is rejected on PostgreSQL. The panel creates new buckets with `id` (uuid, generated), and the API never invents a key.
- `primary` is the key on PostgreSQL and only the display property on MongoDB, so on PostgreSQL relation pickers show the key unless a separate display setting is added later.
- A renamed property is a removal and an addition, because a rename cannot be told apart from them. Explicit rename support would need a hint in the definition.

## Done when

- Creating, editing and deleting buckets of every field type produces the expected tables on PostgreSQL, and a failed edit leaves the bucket untouched.
- Bucket edits on MongoDB behave exactly as today.

## As built

Stack on `postgresql-part5`: #2105 schema manager, #2106 diff, #2116 engine schemas, #2107 naming and key, #2108 DDL plan, #2109 objects and arrays, #2110 relations, #2111 translated, #2112 location, #2113 type changes, #2114 panel.

### What exists

- **Schema manager** (`BucketSchemaManager`, token `BUCKET_SCHEMA_MANAGER`, `packages/interface/bucket/src/schema-manager.ts`): `create`, `replace` and `drop`, bound per engine through `provideRepository` in `ServicesModule`. `BucketService` no longer touches the storage or index methods of the data repository. `onSaved` runs right after the definition is saved (on MongoDB before the index work, so a failing index still reaches the cache and realtime; on PostgreSQL after commit). `drop` also reports the buckets it changed through `onRelatedChanged`. `GET /bucket/capabilities` tells the panel which property types the engine's schema accepts.
- **MongoDB** (`MongoBucketSchemaManager`): the same calls in the same order as before.
- **Diff** (`diffBuckets`, `packages/api/bucket/common/src/schema-diff.ts`): added, removed and retyped properties, `required`, `enum`, `translate`, `generated`, indexes and the `primary` property. The manager uses it to skip DDL for edits that change no structure; the statements come from comparing table metadata.
- **PostgreSQL** (`packages/data/postgresql/src/schema/` and `repositories/bucket/schema-manager.ts`): `naming.ts`, `metadata.ts` (`describeBucket`: tables, columns, foreign keys, indexes, `columnOf(path)`), `primary-key.ts`, `relations.ts`, `ddl.ts` (create and the three-phase update plan), and `PostgresBucketSchemaManager`.
- **Bucket schemas**: `bucket.schema.json` is the common base with eight hooks (`id`, `propertyName`, `propertyType`, `bucketReference`, `propertyOptions`, `propertyRules`, `itemSchema`, `indexes`). `packages/data/mongodb/src/schemas` fills them with the previous values (a regression spec compares 40 definitions with the previous schema), and `packages/data/postgresql/src/schemas` with uuid ids and relation targets, the extra property types, `options.generated`, reserved names, restricted array items and indexes, and a `bucketKey` keyword for the cross-field rules of `primary`. Each adapter provides its extension as `BUCKET_SCHEMA_EXTENSION`, `composeBucketSchema` merges it with the base, and `BucketModule` registers the result at startup, so `--database-type` decides which schema validates.
- **Definition and storage**: the key is derived from `primary`, the type of that property and `options.generated`, so no column or setting was added to `buckets`. `indexes` are stored as ordered pairs (`repositories/bucket/rows.ts`) because `jsonb` sorts object keys, which would reorder compound indexes.
- **Transaction**: the `buckets` row and the DDL run in one `Orm.transaction`, under `lockTransaction("bucket-schema")`. A failed edit leaves the definition and the structure as they were, and database errors of class 22 and 23 come back as 400.
- **Edits**: no edit is refused for the data it would change or the time it takes. Property types are converted in place through text (values that do not fit become `NULL`, and a `NOT NULL` column that would receive `NULL` fails the edit with the database message). Structures that disappear are dropped. The primary key can change generation, type or property; the child tables, self relations and the relation columns and link tables of other buckets follow, using a temporary key map when the property changes. Dropping a bucket removes the relation properties that point at it from the other buckets, with their columns, tables and indexes, in the same transaction.
- **Panel**: new buckets get a generated uuid `id` key on PostgreSQL.

### Differences from the plan

- Objects are always flattened (see the decisions above).
- Index definitions with `expireAfterSeconds` or other Mongo-only options are rejected on PostgreSQL; bucket data expiry needs the Part 4 mechanism applied to bucket tables.
- `hash`, `encrypted` and `json` properties, not in the first mapping, are `text` and `jsonb`.
- The manager has no `validate`: structure is validated by the engine's JSON schema in the controller, and relation targets are resolved inside the transaction, so a relation to a missing bucket fails there with a 400.
- `primaryKey` was dropped in favour of `primary` plus `options.generated`, and the PostgreSQL schema is a separate extension, following review comments on #2107 and #2108.

### Requests to other parts

- **Part 0 / adapter**: `PostgresIdTypes.forBucket(bucketId)` still returns uuid for every bucket; it has to read the key type from `describeBucket` or from the `primary` property of the stored definition.
- **Parts 8 and 9**: `BUCKET_DATA_REPOSITORY`, `BUCKET_QUERY` and `BUCKET_WRITE` are not bound on PostgreSQL, so `ServicesModule` and the bucket module still cannot boot there and the manager is tested directly. `CRUD.replace` and `CRUD.remove` call MongoDB-only `bucketData.unsetFields`/`clearRelation`; on PostgreSQL the manager has already pruned relations, and the language finalizer should delete by `_locale`. The `dependent` relation flag (deleting related documents) is document-level. The compiled document schema (`services/src/schema.ts`) assumes object id relation values and has to follow the target's key type.
- **Part 6**: how the key surfaces on the wire (`_id` stays reserved in property names), and how a missing object differs from an object of null fields.
- **Collection listing**: `PostgresCollectionNames.list()` lists every table in the schema, which now includes `bucket_*` tables and their child tables.

### Not verified

The panel changes were type-checked and built, not run against a PostgreSQL instance, because the bucket module cannot boot on PostgreSQL yet. The PostgreSQL schema is exercised by specs on its own, not through the bucket controller.
