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

_Fill in after the last PR merges._
