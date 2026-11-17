# Part 9: Writes

## How to use this document

- Plan and implement only this part. Read the code from the parts under "Depends on" on master, along with their "As built" sections. Don't open the other documents in `docs/postgresql/`.
- If this part needs something a merged part doesn't provide, stop and list it under "Requests to other parts" in your plan instead of building it.
- Follow the PR breakdown. Each PR is either a behaviour-neutral refactor or new engine code, never both, and is small enough to review in one sitting.
- Existing MongoDB suites stay green. New code brings its own tests, which run on PostgreSQL in CI. Shared behaviour uses contract suites.
- After the last PR, fill in "As built".

## Purpose

Makes bucket data insert, replace, patch and delete work on PostgreSQL behind the write facade. The input is always a JSON document checked by the existing schema validator, so no conversion is needed. One document becomes rows across a bucket's tables, written in one transaction.

## Rules that apply

- Schema validation is engine-agnostic and doesn't change.
- Write rules still evaluate in memory (match mode). Only the loading of the records they need changes.
- Primary keys follow the bucket's definition. A provided key is kept. A missing key is generated if the definition says so, and rejected otherwise.
- Side effects (hooks, history, activity, cache invalidation) don't change.

## Depends on

- **Part 8a (merged):** the system-domain controller writes and the converted system specs. Part 9 extends them.
- **Part 0 (merged):** the write facade.
- **Part 5 (merged):** table metadata and the field mapping.
- **Part 6 (merged):** the result shaper, for returning the saved record.
- **Part 7 (merged):** replacers that read through the facade.
- **Part 8 (merged):** load by key with relations.

## Provides

| Contract               | What later parts expect                                                              |
| ---------------------- | ------------------------------------------------------------------------------------ |
| PostgreSQL write path  | The write facade fully working on PostgreSQL.                                        |
| Native transactions    | `TransactionExecutor` uses a real transaction on PostgreSQL.                         |

## Not this part

- System record writes, which go through the repositories from Part 3.
- Change events from writes (Part 10).

## Today

1. The controller receives a document.
2. The schema validator checks it.
3. The write rule check loads the record and its relations with a Mongo aggregation (`$replaceWith` plus `$lookup`) and evaluates the rule in memory.
4. The bucket CRUD helpers write through the write facade. Patch turns a JSON merge patch into `$set` and `$unset`.
5. Side effects run in-process.
6. `TransactionExecutor` runs multi-step operations with manual rollback steps.

## Target architecture

### Components

| Component              | Responsibility                                                                                                   |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Related-record loader  | Loads what a write rule needs through the query facade's load-by-key: `$lookup` on MongoDB, joins on PostgreSQL. |
| Key handling           | Applies the bucket's primary key rules before writing: keeps, generates or rejects.                              |
| Row writer             | Splits a document into the main row, child rows and link rows and writes them in one transaction. Turns a patch into updates of the affected columns and child rows. |
| Delete                 | Removes the rows, relying on foreign key behaviour for relation cleanup where it can.                            |
| Error mapping          | Maps unique and foreign key violations to the same error responses that MongoDB-backed checks return today.      |
| Native transactions    | A PostgreSQL mode for `TransactionExecutor`.                                                                     |

### Flow

1. A user sends a write.
2. The schema validator checks the document.
3. The related-record loader fetches what the write rule needs, and the rule runs in memory.
4. The write facade hands the document to the row writer, which writes everything in one transaction.
5. The saved record is read back through the result shaper.
6. Side effects fire as today.

## What changes

- **Write rule check:** loads related records through the facade, on both engines.
- **Write facade:** a new PostgreSQL implementation.
- **`TransactionExecutor`:** gets a native mode.

## PR breakdown

1. Write rules load related records through the facade on MongoDB. This is a behaviour-neutral refactor.
2. Row writer insert for scalar fields and objects stored as columns.
3. Insert for child tables and relations.
4. Replace and patch.
5. Delete, with relation cleanup.
6. Constraint error mapping.
7. Native transactions in `TransactionExecutor`.

## Open questions

- Should patches on array fields rewrite the whole child table, or diff it?

## Requests from other parts

### Encrypted fields in access rules (from Part 7)

Part 5 stores an `encrypted` property as one `text` column that holds the ciphertext. Ciphertext is not deterministic, so a rule cannot compare an encrypted field. On MongoDB the stored value is `{encrypted, hash}` and a rule compares `<field>.hash` with `hash(value, secret)`.

- **What Part 9 has to do.** Store a deterministic hash next to the ciphertext when a document is written (insert, replace and patch), for example in a second column of the same table. Part 5 is merged, so adding the column is a change to the table layout and the DDL planner in `packages/data/postgresql/src/schema/`, shipped with the first PR that writes encrypted values.
- **What Part 7 does until then.** The rule compiler refuses any rule that mentions an encrypted field, with an `UnsupportedRuleError` that becomes a 400 when the bucket is saved. The refusal is in `packages/data/postgresql/src/access/rule/fields.ts`, in two places: a field of the bucket and a field of a related bucket reached through a one-to-many relation.
- **What changes in Part 7 code when the hash lands.** Lift both refusals, and make `access/rule/coerce.ts` hash a string literal with the secret and compare it with the hash column, as the MongoDB replacer does.
- **Tests that exist only to pin the refusal.** They carry the marker `[part9-encrypted]` (`grep -rn part9-encrypted packages`). When the hash lands, remove them, or rewrite them to assert the comparison, in the same PR as the compiler change. They are in `packages/data/postgresql/test/access/`:
  - `rule-fixtures.ts`: the `secret: {type: "encrypted"}` properties of the main and the related bucket.
  - `rule-compiler.spec.ts`: the encrypted case of the "unsupported" list.
  - `rule-relations.spec.ts`: the encrypted case of a one-to-many list, and "should refuse encrypted and list fields of the related bucket".
  - `field-rules.spec.ts`: the field rule that mentions `document.secret`.
  - `rule-validator.spec.ts`: the `secret` properties of the three test buckets, and the cases that expect an encrypted field to be rejected for a read rule, a related bucket and a field rule.

## Done when

- Insert, replace, patch and delete give the same responses, hooks, history and activity on both engines.
- A failed PostgreSQL write leaves no partial rows.

## As built

### The planned items

| PR | What it is |
| --- | --- |
| #2177 | **Document key.** `IdTypes.keyField(bucket)` names the key field (`_id` on MongoDB, `bucket.primary` on PostgreSQL). `documentKey`, `documentKeyField` and `withDocumentKey` in `bucket-common` replace the hard-coded `_id` in the bucket data controller, GraphQL, the realtime insert and the activity helper. The compiled input schema adds `_id` only where `_id` is the key and handles `uuid` and `bigint` properties. |
| #2179 | **Write rules through the facade.** `checkWriteRule` (`bucket-common/src/write-rule.ts`) replaces the `$replaceWith` + `$lookup` aggregation of the MongoDB facade. It loads the records a rule reads by key through `BUCKET_QUERY` (one `find` per top-level relation, nested relations through `relationPaths`), so one check serves both engines. Pinned first by nine MongoDB specs. |
| #2180 | **`BUCKET_DATA_REPOSITORY`** (assigned to this part by documents 05 and 08a, not listed above). `findById`, per-bucket and total counts, and removing the rows of deleted languages (`unsetFields`). `createStorage`, `dropStorage`, `syncIndexes` and `clearRelation` do nothing, since the schema manager and foreign keys do that work. |
| #2181 | **Row writer, main table.** `PostgresBucketWriteFacade.insert`: write rule, `REMOVE` limit, then one transaction for the total and count limits and the row. Key rules, identity sequence kept ahead of a given key, `jsonb`, `point`, `bigint` and timestamp values. A string primary key cannot be combined with removing the oldest documents (rejected when the bucket is saved). |
| #2182 | **Encrypted values.** `<field>__hash` column (path `[...field, "hash"]`) for new buckets, ciphertext as JSON text, `{encrypted, iv, authTag, hash}` rebuilt on read. Both Part 7 refusals are lifted, filters and rules hash their literals, and the `[part9-encrypted]` tests assert the comparison. |
| #2183 | **Child tables.** Lists, multiselects, lists of objects, translations and one-to-many links, in the transaction of the main row, in batches of at most 30,000 parameters. |
| #2184 | **Replace and patch.** Row lock, previous record loaded, answered before or after as MongoDB does. A replacement rewrites every column and child table. A patch rewrites only what it touches, taking values from the merged document; a changed list, translation or relation rewrites its whole child table (the open question: a merge patch replaces a list as a whole). |
| #2185 | **Delete.** The foreign keys remove child rows and links, and clear references that are not required. |
| #2186 | **Constraint errors.** Unique violations answer with MongoDB's exact message, foreign key, not-null and enum violations name the property, other value errors are `Database error: ...`. |
| #2187 | **Native transactions.** `TransactionExecutor(runner?)`; steps marked `native` are undone by the runner's transaction, the others are rolled back by hand after it. `Orm.runInTransaction` makes the connection ambient (`AsyncLocalStorage`) so repositories take part without a signature change; a joined `orm.transaction` runs in a savepoint; a call made after its transaction ended is refused. The storage service uses it for its two database steps. |
| this PR | **Spec sweep.** See below. |

### Found while converting

Each of these was a gap that a spec passing on MongoDB exposed on PostgreSQL:

- **Retargeted relations.** Changing the target bucket of a relation made the schema manager add a foreign key over values that referred to the old bucket, and the change failed. The planner now clears them (`NULL` for a nullable column, no rows for a link table) between dropping the old constraint and adding the new one. A required column cannot be cleared; that change is refused with the constraint error.
- **Filters and secrets.** `compileFilter` and `compileFilterNode` accepted a hash secret and never passed it on, so a filter on a hash or encrypted field compared the plain literal. Both pass it now.
- **History.** `createHistory` read the document id from `_id`, and `getDocument` still threw "not stored on PostgreSQL yet". `createHistory(bucketId, documentId, previous, current)` takes the document id from the caller, and `getDocument` reads through the query facade.
- **Decryption errors.** `decryptDocumentFields` named the document by `_id`; it asks for the bucket's key.

### Write rule subject

A write rule is evaluated against the document the caller sent for an insert, a replace and a patch (the merged document), and against the stored document for a delete. This is the behaviour MongoDB has always had; it is the same on both engines.

### Differences between the engines

- A missing scalar is `null` in a PostgreSQL document and absent in a MongoDB one, an empty one-to-many relation is `[]` on PostgreSQL and absent on MongoDB (also noted in document 08). The shared specs drop nulls through a helper where it matters.
- **`null` in a body.** MongoDB rejects it for a typed property (`400 .title must be string`). PostgreSQL accepts it for an optional property and stores NULL, because the property is a column and NULL is how it is unset; this also lets a client send back the document it read. A required property, the key, a translated property, and the properties kept in child tables or flattened columns (an array with items, a one-to-many relation, an object with properties) stay strict: they read back as `[]` or `{}`, never `null`. An `enum` accepts `null` too. A value of the wrong type is reported as `.title must be string,null` instead of `.title must be string`. The PostgreSQL adapter declares `nullableProperties` in its `DataCapabilities` (the `DATA_CAPABILITIES` token); the schema resolver reads it and compiles with `nullable`, so no module compares engine names. MongoDB declares nothing.
- **Missing, default and `null`.** A missing field takes the property's `default`, else NULL. An explicit `null` stays NULL and no default is applied. The exception is the `:created_at` and `:updated_at` defaults, which fill in the time for `null` as well, on both engines.
- **`null` in a patch.** It clears the value (merge patch). A column is set to NULL and never dropped; MongoDB removes the key. A `json` value, a free-form object and an array without items are `jsonb` columns: a nested `null` removes the key inside the value on both engines, and a top-level `null` is SQL NULL, not the JSON value `null`. An object with properties or an array with items is cleared to `{}` or `[]`.
- An empty patch answers the unchanged document on PostgreSQL; MongoDB answers `400 Database error: Argument "update" must be an object`.
- A link to a document that does not exist is a 400 on PostgreSQL; MongoDB stores it. Deleting a document that a **required** one-to-one reference points to is refused on PostgreSQL; MongoDB unsets the reference and leaves a document that breaks its own `required`.
- Filtering inside a `json` value, and the advanced filter constructors of MongoDB JSON filters (`Date(...)`), are MongoDB only.
- Existing PostgreSQL buckets do not get the `__hash` column of an encrypted property. Only buckets created after Part 9 have it; writing an encrypted value into an older table fails with a database error.
- The `REMOVE` limit deletes the lowest key first, which is the oldest document only for generated uuid, integer and bigint keys.

### Specs

- **Shared (both engines):** `contract/bucket-write.spec.ts` (insert, replace, patch, delete, unique indexes, limits, write rules, encrypted values), `contract/bucket-data-repository.spec.ts`, and under `packages/api/bucket`: the post/put/patch, delete, unique, limitation, defaults, json, field-level authorization, relation-disposal, read (`bucket-data/index.spec.ts`), side effects (history, activity and hooks of every write), schema changes, `bucket.module`, `bucket.e2e`, hash, encrypted and the three expression specs. Also the hook factory and `preference.integration` (which exercises the removal of deleted languages). The harness is `packages/api/bucket/test/support/bucket-app.ts`: it adds the key property to bucket definitions on PostgreSQL and takes the engine differences out of the spec bodies.
- **PostgreSQL only:** `test/write/{insert,update,delete,errors}.spec.ts`, `test/transaction.spec.ts`.
- **Still `mongoOnly`:** `bucket.controller.spec.ts` (MongoDB's bucket model; PostgreSQL buckets are covered by `schema-manager.spec`, `bucket-schema.postgresql.spec` and `bucket-schema-changes.spec`), `history.controller.spec.ts` (seeds MongoDB collections; history on writes is covered by `side-effects.spec.ts`), `bucket.service.spec.ts` (MongoDB index definitions), `graphql.spec.ts`, and the two MongoDB-syntax filter specs `json-field-filter.spec.ts` and `index-mongodb-filters.spec.ts`.
- The temporary helpers are gone: `bucket-store.ts` and `access-store.ts` write through `BUCKET_WRITE`, and `row-set-fixtures.ts` keeps only `fetchRowSet`.
- Specs that install assets clear the asset registries first, since two engines share a process (as in document 08a).

### Requests to other parts

- **GraphQL (no part owns it yet):** the schema names every document by `_id` and the `ObjectId` scalar and passes MongoDB-shaped ids. A PostgreSQL bucket's key and its types need a schema change before `graphql.spec.ts` can run on both engines. The write path (`BUCKET_WRITE`, history) is ready.
- **Part 10:** the realtime gateway reads `_id` from client messages and answers inserts by key; its wire format has to name the key field, and its writes have to go through the same facade (it already does). Change events from writes are Part 10's.
- **Relation values and the target key (open):** the compiled input schema still validates relation values as `objectid-string`. PostgreSQL's unscoped id type is a uuid, so a relation to a bucket with an integer, bigint or text key is rejected by the validator before it reaches the writer. Relations to uuid-keyed buckets work. It needs the target's key type in `compile`.
- **Part 12 (panel):** the panel still assumes `_id` for documents (document 08).
