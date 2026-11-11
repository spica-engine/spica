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
| `Keyed<T>`, `idOf`, `withId`, `assignId`, `stripId`, `omitId` | Typed access to a record's key, so no code spells the property name. `withId` and `omitId` return copies; `assignId` and `stripId` change the record in place. |
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
  - eight system JSON schemas that declare `_id`.
- Another 2,463 uses are in specs.
- `packages/database` (`pipeline/resource-filter.ts`, `realtime/stream.ts`, `collection.ts`) builds MongoDB queries and change stream reads. Each use has to be classified as MongoDB-only (allowlisted) or reachable from engine-agnostic code (moved behind the adapter, as Part 0 planned for `resourceFilterFunction`).
- Bucket data leftovers named by Parts 9 and 10: GraphQL (names every document by `_id` and the `ObjectId` scalar), the realtime gateway's wire format, rule expressions that use `document._id`, and `bucket/services/src/schema.ts`, which branches on `keyField == "_id"`.

## Target architecture

### Components

| Component              | Responsibility                                                                                                         |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `IdTypes.systemKeyField()` | Added to the `IdTypes` contract next to `keyField`. Each adapter answers with its own name.                         |
| Record helpers         | In `@spica-server/data`: `idOf`, `withId`, `assignId`, `stripId`, `omitId`. Only these read the property by computed name. |
| `Keyed<T>`             | Marks a record that carries its key. Interfaces such as `Identity` stop declaring `_id`; the brand is optional, so repositories keep returning the plain interface. |
| Schema hook            | The eight system schemas declare the key as `$systemKey`. `Validator` swaps it for `ids().systemKeyField()` when a schema is registered, validated or given as an option, and refuses a schema that names it when no id types are available. |
| Persisted field names  | Asset and differ `uniqueField`, sync `IGNORED_FIELDS`, the filter validator and the expression functions read the name from the resolver. |
| Devkit record types    | Published types are fixed per release, not per instance, so they cannot name the key. In `auth`, `identity` and `storage`, `_id` becomes optional and `@deprecated`, pointing to `idOf`; it is `undefined` on PostgreSQL. It is removed in a later major version. Each package exports `idOf(record)`, which returns `_id` when the record has one and `id` otherwise; that is safe for system records because a record has exactly one of the two. Bucket documents keep using the bucket's `primary`. |
| Ratchet                | AST-based script, a per-file baseline, an allowlist of the MongoDB adapter and MongoDB-only packages, and `--strict --under=<path>/` like `check:engine-specs`. |

### The two-phase flip

PostgreSQL keeps reporting `_id` from `systemKeyField()` until the last refactor merges. That makes every refactor PR behaviour-neutral on both engines. One small PR then changes the answer to `id` and drops the ORM overrides. If the flip came per domain, a consumer in another domain (the action guard reading policies, the activity interceptor) would see a half-converted world.

### Typing

TypeScript cannot name a property from a runtime value, so `idOf`, `withId`, `assignId`, `stripId` and `omitId` are the only places that index a record by `systemKeyField()`, and the record interfaces stop declaring `_id`. `Keyed<T>` is `T` plus an optional brand. The first design made the brand required, so that a payload without a key could not reach `idOf`. It was dropped in PR 4a: every repository of both adapters would have had to cast its results to return a branded record, and the PostgreSQL ORM would have had to depend on `interface-data`. The check it gave (`idOf` on a payload with no key) is the same one `_id?: Id` never gave, so nothing is lost. Helpers that change a record in place (`assignId`, `stripId`) exist because asset installation and several controllers rely on the mutation: the asset operators work on copies that are stored afterwards.

### Wire

- MongoDB responses are byte-identical to today.
- PostgreSQL system responses carry `id`. Bucket documents keep the bucket's own key.
- `GET /status/engine` does not change. A client reads a record's key from the record itself. A client that has to name the key before it has a record (a sort, a filter) already knows the engine, which it needs for the filter language, and maps `mongodb` to `_id` and `postgresql` to `id`, the same way it maps the engine to a filter language.

## PR breakdown

Each PR runs on both engines in CI. Specs of a domain are moved to the test helpers in the same PR as the domain's code, and classified as `contractSuite` or `mongoOnly` as the README requires.

| #  | PR                                  | Content                                                                                                                                                                      |
| -- | ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1  | **Foundation** (new code)           | `systemKeyField()` on both adapters (PostgreSQL still `_id`), `Keyed`, `idOf`, `withId`, `omitId`, test helpers, the ratchet with its baseline and CI step. Type spike on passport. |
| 2  | **Codemod**                         | `yarn codemod:key-names --project=<tsconfig>... --only=<path>/ [--any-is-system=<path>/] [--write]`, built on the TypeScript compiler API. It rewrites `x._id` to `idOf(x)` and a literal typed as a system record to `withId(...)` (several passes, so nested uses work) when the declared type comes from `packages/interface`, and lists the rest for manual edits: deletes, assignments, destructuring, strings, untyped receivers, literals without a system record type. `--any-is-system` treats untyped receivers under a path as system records. It is a dry run unless `--write` is given. |
| 3  | **Shared code** (refactor)          | The eight system schemas (asset, function, API key, policy, dashboard, bucket, secret, env var) declare the key as `$systemKey`, and `Validator` names it from the engine's id types; the asset strategies and the differ's required `uniqueField` take the key from `systemKeyField()`; `packages/filter` (the MongoDB filter language) joins the ratchet's exemptions. The `interface/*` record types move with their domain in PRs 4a to 4e, because changing one forces every consumer of it to change in the same PR. |
| 4a | **Passport** (refactor)             | Identity, user, policy, API key, strategy, refresh token, verification, including nested `signUpStrategy`. The built-in policies lose their `_id` line and become a registry keyed by name; `PolicyService` adds the key when it first reads them, because the files are evaluated before the data layer is bound. |
| 4b | **Function** (refactor)             | Function, webhook, logs, enqueuer, trigger payloads and the asset reconciler. `StoredFunction` and the inline `Function & {_id: Id}` become `Keyed<Function>`; the sort defaults of the webhook and log lists use a `DEFAULT` factory so the key is read per request; `JobMeta` and the in-process change event's `documentKey` become keyed types, so the replication and env var domains read them through `idOf` in 4d. |
| 4c | **Bucket system side** (refactor)   | Bucket records, history, activity resource builders, hooks, `bucket/services/src/schema.ts`. `Bucket` and `History` stop declaring `_id`, which also moves every read of a bucket's own id in the GraphQL, realtime and expression code, and in the MongoDB and PostgreSQL adapters. Bucket documents stay for PR 5: `BucketDocument`, the data activity helper and the document reads and filters. |
| 4d | **Other system domains** (refactor) | Storage, secret, env var, dashboard, preference, status, replication, activity, asset. `Resource` (the asset resource), `ResourceLister`'s items and the stored `Asset` are keyed types, so asset resources carry the key under `systemKeyField()` like the records they describe; sort defaults and the activity list sort read the key per request; the change events of env var, secret and preference are built with `withId`. The PostgreSQL contract specs of the earlier domains still read `_id` off typed records; they are converted with the adapters in PR 6b. |
| 4e | **Sync and representative** (refactor) | `packages/sync` and `apps/cli` have no data layer, so they cannot call `idOf`. `packages/sync/src/record-key.ts` is the one place that names both keys: `recordKey` reads whichever of `_id` and `id` a record carries, `KEY_FIELDS` is what update detection ignores, and `fetchSystemKeyField` asks `GET /status/engine` where a key has to be named before any record exists (`asset apply`, which also accepts UUID resource folders). The CLI's document-level `_id` (bucket data, the generated ORM) stays for PR 5. The file and its spec are exempt from the ratchet. |
| 4f | **Devkit** (refactor)               | `_id` is optional and `@deprecated` in the `auth`, `identity` and `storage` record types and in the `bucket` package's `Bucket` definition type. `@spica-devkit/internal_common` has one `idOf`, which `auth`, `identity` and `storage` re-export (the bundled declaration inlines it). `auth` and `identity` read the key through it. Not breaking: existing function code still compiles. The bucket package's documents and realtime operators (`document._id`, the `{_id: {$in}}` relation filter) are bucket data and stay for PR 5: they need the bucket's own key and a filter in the engine's language, which `README.md` says this package does not get. `database` and `testing` are untouched. |
| 5  | **Bucket data leftovers**           | The realtime gateway reads and writes a document's key with `documentKey` and `withDocumentKey` (including the cascade delete of dependents, which resolves the target bucket first); the data activity builder takes the inserted key from `req.documentKey`, which every insert path sets; `BucketDocument` stops declaring `_id`; the server-side representative keys its resource with `withId`. Kept literal because they are MongoDB-shaped and join the ratchet's exemptions: GraphQL (its generator has no PostgreSQL property types and its spec is `mongoOnly`), the rule converters `convert.ts` and `builtin_funcs.ts` (they render MongoDB filters), the devkit bucket package's documents and realtime operators and the CLI's generated ORM (both sit on the MongoDB client the README keeps as is), `project start` (the replica set config), and the deprecated `_id?` declarations of the `auth`, `identity` and `storage` devkit types. |
| 6  | **Database package triage**         | Classify each `_id` in `packages/database`: allowlist if MongoDB-only, otherwise move behind the adapter.                                                                    |
| 6b | **Adapter specs** (refactor)         | The MongoDB and PostgreSQL adapter specs read and write the key through `idOf` and `withId` (about 330 uses in `data/postgresql` alone), so the flip changes no spec. |
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
- **Flip sites found on the way.** `packages/data/postgresql/src/entities/function.ts` types its record as `Function & {_id?: Id}` so the repository can select and order by the storage key; the PostgreSQL bucket schema spec builds its validator with `MongoIdTypes`; the env var and secret services still build `documentKey: {_id: ...}` for the change dispatcher (4d). The PostgreSQL bucket and history entities are typed `Bucket & {_id?: Id}` and `History & {..., _id?: Id}` for the same reason as the function entity. PR 7 changes each of them.
- **Docs drift.** The README says PostgreSQL responses use `id`, but the code does not yet. PR 8 makes the docs true.

## As built

To be filled in by the last PR.
