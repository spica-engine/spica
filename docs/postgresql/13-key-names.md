# Part 13: Key names

## How to use this document

- Plan and implement only this part. Read the code on master and the "As built" sections of the parts under "Depends on".
- Follow the PR breakdown. Each PR is either a behaviour-neutral refactor or new engine code, never both.
- Existing MongoDB suites stay green and unchanged in behaviour in every PR.
- After the last PR, fill in "As built" and update the README's "Key name in responses" row if anything differs.

## Purpose

The system should run without knowing which engine is under it. Key names are one of the last places where it does not. The primary key of a record is `_id` on MongoDB and `id` on PostgreSQL, and today the services, interfaces, schemas and tests hard-code `_id`. On PostgreSQL the ORM maps the `id` column back to a property called `_id` so that code keeps working, which means a PostgreSQL user sees `_id` holding a UUID v7. This part removes the hard-coding. After it, MongoDB records and responses carry `_id` and PostgreSQL ones carry `id`, with no rename anywhere in between.

## Rules that apply

- Two kinds of collection, two resolvers:
  - **System collections** (buckets, activity, API keys, identities, and every collection known before runtime). Key name and type are fixed per engine. The name is a boot-time constant: `ids().systemKeyField()`.
  - **Bucket data collections.** The key is chosen by the bucket's owner on PostgreSQL and is `_id` on MongoDB. Already resolved by `ids().keyField(bucket)` and the `documentKey` helpers in `bucket-common`.
- No code outside the MongoDB adapter writes the literal `_id`, in implementations, interfaces, schemas, responses or tests. Code that must name a key calls a resolver or a helper.
- The backend defines the contract. Clients (panel, devkit packages, sync) follow it.
- No conversion layer. Records are engine-native from the storage up to the response.
- PostgreSQL has no existing installs, so nothing is migrated. MongoDB data and behaviour are untouched.
- Moving data between engines is out of scope.

## Depends on

- **Part 3 (merged):** system entities and the ORM (`idProperty`).
- **Part 5 (merged):** bucket primary key metadata.
- **Part 8a (merged):** controller writes return the stored record.
- **Part 9 (merged):** `keyField` and `documentKey` for bucket data.
- **Part 10 (merged):** neutral `ChangeEvent` with `key`.

## Provides

| Contract                         | What it gives                                                                                              |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `ids().systemKeyField()`         | `"_id"` on MongoDB, `"id"` on PostgreSQL.                                                                  |
| `Keyed<T>`, `idOf`, `withId`, `omitId` | Typed access to a record's key, so no code spells the property name.                                 |
| `scripts/check-key-names.mjs`    | A ratchet that counts `_id` literals outside the MongoDB adapter and fails when a file's count grows.     |
| Devkit `idOf(record)`            | Exported by the REST-based devkit packages (`auth`, `identity`, `storage`). Their record types no longer declare the key; this helper reads it.   |
| Test helpers                     | `idOf`, `withId` and `systemKeyField()` usable from specs, so one spec runs on both engines.               |

## Not this part

- The admin panel. Its follow-up is listed under "Requests to other parts".
- **`@spica-devkit/database` and `@spica-devkit/testing`.** They are not changed. `database` hands out a MongoDB client and has nothing to do with the REST record types; its `_id` uses are MongoDB's own and are allowlisted in the ratchet. `testing` is allowlisted the same way unless it turns out to read system records.
- **A PostgreSQL database package.** Whether Part 11 writes one is undecided, and nothing here depends on it. Function code on PostgreSQL can use a PostgreSQL driver directly.
- Bucket data primary keys. They are done; only the leftovers in "Bucket data leftovers" are here.
- Anything inside `packages/data/mongodb`, which keeps `_id` because that is MongoDB's name.

## Today

- System entities in `packages/data/postgresql/src/entities` all set `idProperty: "_id"`. The ORM default is `id`, so the override is what makes PostgreSQL records carry `_id`. One nested copy exists too: `users.signUpStrategy` embeds `_id` over a column named `id`.
- Outside tests, outside the MongoDB adapter and outside the panel there are about 450 uses in `packages/api`, `sync`, `database`, `core` and `filter`, and about 28 more in the REST-based devkit packages (`auth` 6, `identity` 4, `storage` 1, `bucket` 17):
  - about 265 property reads (`identity._id`),
  - about 130 interface and type declarations (`_id?: Id`),
  - about 120 object literals that build or match a record,
  - about 20 string literals (`uniqueField: "_id"` in assets and the differ, `IGNORED_FIELDS` in sync, `key == "_id"` in the filter validator and the bucket expression functions),
  - nine system JSON schemas that declare `_id`.
- Another 2,463 uses are in specs.
- `packages/database` (`pipeline/resource-filter.ts`, `realtime/stream.ts`, `collection.ts`) builds MongoDB queries and change stream reads. Each use has to be classified as MongoDB-only (allowlisted) or reachable from engine-agnostic code (moved behind the adapter, as Part 0 planned for `resourceFilterFunction`).
- Bucket data leftovers named by Parts 9 and 10: GraphQL (names every document by `_id` and the `ObjectId` scalar), the realtime gateway's wire format, rule expressions that use `document._id`, and `bucket/services/src/schema.ts`, which branches on `keyField == "_id"`.

## Target architecture

### Components

| Component              | Responsibility                                                                                                         |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `IdTypes.systemKeyField()` | Added to the `IdTypes` contract next to `keyField`. Each adapter answers with its own name.                         |
| Record helpers         | In `@spica-server/data`: `idOf(record)`, `withId(record, id)`, `omitId(record)`. Only these read the property by computed name. |
| `Keyed<T>`             | The type of a stored record. Interfaces such as `Identity` stop declaring `_id`; repositories return `Keyed<Identity>`. Code that has no key (an insert payload) uses plain `Identity`. |
| Schema hook            | The nine system schemas stop declaring `_id`. A shared helper adds the engine's key property when the schema is registered, as `BUCKET_SCHEMA_EXTENSION` already does for buckets. |
| Persisted field names  | Asset and differ `uniqueField`, sync `IGNORED_FIELDS`, the filter validator and the expression functions read the name from the resolver. |
| Devkit record types    | Published types are fixed per release, not per instance, so they cannot name the key. In `auth`, `identity` and `storage`, `_id` becomes optional and `@deprecated`, pointing to `idOf`; it is `undefined` on PostgreSQL. It is removed in a later major version. Each package exports `idOf(record)`, which returns `_id` when the record has one and `id` otherwise; that is safe for system records because a record has exactly one of the two. Bucket documents keep using the bucket's `primary`. |
| Ratchet                | AST-based script, a per-file baseline, an allowlist of the MongoDB adapter and MongoDB-only packages, and `--strict --under=<path>/` like `check:engine-specs`. |

### The two-phase flip

PostgreSQL keeps reporting `_id` from `systemKeyField()` until the last refactor merges. That makes every refactor PR behaviour-neutral on both engines. One small PR then changes the answer to `id` and drops the ORM overrides. If the flip came per domain, a consumer in another domain (the action guard reading policies, the activity interceptor) would see a half-converted world.

### Typing

TypeScript cannot name a property from a runtime value, so `Keyed<T>` is `T` plus a unique-symbol brand, and `idOf` and `withId` are the only places that index by `systemKeyField()`. The first PR spikes this on the passport domain, the heaviest user, before anything else depends on it. If the brand makes spreads or mapped types painful, the fallback is `T & Record<string, unknown>` plus the helpers, with a lint rule against property access to the key.

### Wire

- MongoDB responses are byte-identical to today.
- PostgreSQL system responses carry `id`. Bucket documents keep the bucket's own key.
- `GET /status/engine` does not change. A client reads a record's key from the record itself. A client that has to name the key before it has a record (a sort, a filter) already knows the engine, which it needs for the filter language, and maps `mongodb` to `_id` and `postgresql` to `id`, the same way it maps the engine to a filter language.

## PR breakdown

Each PR runs on both engines in CI. Specs of a domain are moved to the test helpers in the same PR as the domain's code, and classified as `contractSuite` or `mongoOnly` as the README requires.

| #  | PR                                  | Content                                                                                                                                                                      |
| -- | ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1  | **Foundation** (new code)           | `systemKeyField()` on both adapters (PostgreSQL still `_id`), `Keyed`, `idOf`, `withId`, `omitId`, test helpers, the ratchet with its baseline and CI step. Type spike on passport. |
| 2  | **Codemod**                         | A ts-morph script that rewrites reads and literals when the receiver's declared type is a system record, and reports the rest for manual edits. Lands as a script, not as a code change. |
| 3  | **Shared code** (refactor)          | `interface/*` types, `core/differ`, asset strategies, `filter` validator, the nine schemas through the schema hook (a regression spec compares the composed MongoDB schemas to today's files). |
| 4a | **Passport** (refactor)             | Identity, user, policy, API key, strategy, refresh token, verification, including nested `signUpStrategy`. Biggest batch; may split in two.                                     |
| 4b | **Function** (refactor)             | Function, webhook, logs, enqueuer, trigger payloads and the asset reconciler.                                                                                                |
| 4c | **Bucket system side** (refactor)   | Bucket records, history, activity resource builders, hooks, `bucket/services/src/schema.ts`.                                                                                  |
| 4d | **Other system domains** (refactor) | Storage, secret, env var, dashboard, preference, status, replication, activity, asset.                                                                                        |
| 4e | **Sync and representative** (refactor) | `packages/sync` and `apps/cli`: `IGNORED_FIELDS`, remote id extraction, the key name taken from the records it receives. Where sync must name the key before it has a record, it asks `GET /status/engine` and maps the engine to a key name.                                                                                     |
| 4f | **Devkit** (refactor)               | Mark `_id` optional and deprecated in the `auth`, `identity` and `storage` record types, add `idOf`, move the `bucket` package off literal `_id` (it takes the key from the bucket's `primary`), and update those packages' specs. `database` and `testing` are untouched. Not breaking: existing function code still compiles. |
| 5  | **Bucket data leftovers**           | GraphQL schema and scalar, realtime gateway messages, `document._id` in rule expressions and expression functions. Independent of 4, so it can run in parallel.              |
| 6  | **Database package triage**         | Classify each `_id` in `packages/database`: allowlist if MongoDB-only, otherwise move behind the adapter.                                                                    |
| 7  | **Flip**                            | PostgreSQL `systemKeyField()` answers `id`; remove the `idProperty` overrides, the `_id` where-clauses and order-by in repositories, and the nested `signUpStrategy._id` column mapping. Full contract sweep on CI. |
| 8  | **Close**                           | Ratchet `--strict` over the whole tree, README and part documents updated, the bridge in step 1 removed.                                                                      |

## Requests to other parts

- **Part 12 (panel):** `useKeyField()` without a bucket id maps `useEngine()` to `_id` or `id`. Drop the "system records keep `_id`" rule. Included for reference only; the backend does not wait for it.
- **Part 11 (devkit):** nothing is requested. The REST-based packages (`auth`, `identity`, `storage`, `bucket`) are changed here, in PR 4f.

## Risks and open items

- **The `Keyed` brand.** Decided by the spike in PR 1.
- **Devkit types keep a deprecated `_id`.** Dropping it would fail the build (422) of every TypeScript function that reads `identity._id`, the next time it is saved. The cost of keeping it is that the types still name `_id` on PostgreSQL, where it is `undefined`. PostgreSQL has no existing installs, so no old code depends on it, and the deprecation points new code to `idOf`. Removing `_id` is a later major version.
- **Cross-domain readers.** The action guard, activity interceptor and realtime code read other domains' records. Covered by the two-phase flip.
- **Stored JSON that mentions a key.** `histories.changes`, `dashboards.components`, `functions.triggers` and `assets` are JSONB. Audit them for key names that were written by the system rather than by a user, in PR 7.
- **Event payloads.** Change events delivered to user functions and webhooks must keep their documented shape (Part 10). Check that none of them copies a system record's key under a fixed name.
- **Mongo-only specs.** Specs that write to MongoDB collections directly keep `_id`; they are `mongoOnly` and allowlisted.
- **Docs drift.** The README says PostgreSQL responses use `id`, but the code does not yet. PR 8 makes the docs true.

## As built

To be filled in by the last PR.
