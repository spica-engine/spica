# Part 0: Data access foundation

> MongoDB only. Every PR in this part is a behaviour-neutral refactor.

## How to use this document

- Plan and implement only this part. Don't open the other documents in `docs/postgresql/`.
- If this part seems to need PostgreSQL code, it doesn't. Stop and list it under "Requests to other parts" in your plan.
- Follow the PR breakdown. Each PR is a behaviour-neutral refactor, small enough to review in one sitting.
- Existing test suites must pass with no changes to their assertions. New layer code gets its own unit tests.
- After the last PR, fill in "As built".

## Purpose

Puts a data access layer between the API and MongoDB without changing behaviour, so that later parts can add PostgreSQL behind it. After this part, nothing outside the MongoDB adapter talks to MongoDB directly.

## Rules that apply

- Controllers and guards stay engine-agnostic. They describe what they want, and only the adapter knows how MongoDB expresses it.
- No behaviour change: same responses, same errors, same performance characteristics.
- One engine per instance. The layer binds one adapter at boot. For now that is always MongoDB.

## Depends on

Nothing.

## Provides

Later parts build on these. Keep them stable once merged, and record their final names in "As built".

| Contract                  | What later parts expect                                                                                         |
| ------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Adapter registration      | One place where an engine adapter binds its implementations of the contracts below.                            |
| Engine-aware id type      | What services use instead of constructing `ObjectId`. It parses, validates, compares and serializes ids. It must allow the key type to differ per table, because on PostgreSQL every bucket defines its own primary key. |
| Id param pipe             | Replaces the `OBJECT_ID` pipes in controllers. It validates against the key type of the resource being addressed. |
| Query facade              | One entry point for reads, using today's builder vocabulary: by id, resource filter, caller filter, relations, locale, fields, sort, skip, limit, paginate. |
| Write facade              | One entry point for bucket data insert, replace, patch and delete.                                              |
| Repository pattern        | A repository interface per system domain, a provider that binds the engine's implementation, and MongoDB repositories wrapping today's services. |
| Change feed               | One subscription API for insert, update, replace and delete events, with documents in today's shape.           |
| Result shaper hook        | A step every facade read and write passes through. On MongoDB it does nothing.                                  |

## Not this part

- Anything PostgreSQL: connection, tables, SQL, LISTEN/NOTIFY.
- Changing how ACL is rendered. The facade accepts today's resource filter as it is.
- New features or changed responses.

## Today

- Controllers build aggregation stages with `PipelineBuilder` (`@spica-server/database/pipeline`) and the bucket pipeline builder (`bucket/common`), then call `aggregate` on a service.
- Domain services extend `BaseCollection` and call MongoDB methods directly.
- About a dozen places call `watch()`:
  - realtime (`@spica-server/database/realtime`)
  - the bucket, config, env var, secret and preference services
  - the function database enqueuer, webhooks and the function asset watcher
  - the asset service
  - replication (`MongoMemory`)
- `new ObjectId(id)` appears across services. Controllers validate ids with `OBJECT_ID` pipes.
- Bucket data writes go through CRUD helpers in `bucket/common` that call collection methods.

## Target architecture

### Components

| Component             | Responsibility                                                                                    |
| --------------------- | ------------------------------------------------------------------------------------------------- |
| Data access layer     | A package that defines the contracts above and has no MongoDB imports.                            |
| MongoDB adapter       | Implements every contract with today's code: builders, collections, change streams, `ObjectId`.  |
| Callers               | Controllers, services and watchers depend on the contracts, not on MongoDB.                      |

### Flow

1. A controller calls the query or write facade, or a service calls its repository.
2. The facade or repository forwards to the MongoDB adapter, which runs today's code.
3. The result passes through the result shaper hook and returns unchanged.
4. Watchers subscribe to the change feed. The MongoDB adapter feeds it from change streams.

## What changes

- New layer package and MongoDB adapter package.
- Callers move to the contracts, in batches by domain.
- An import rule (lint) stops code outside the adapter from importing MongoDB APIs, so regressions are caught in review. The devkit and `apps/migrate` are exempt.

## PR breakdown

1. Layer package with the adapter registration point and the engine-aware id type. Adds no callers.
2. Id type and id param pipe adopted, one PR per domain group: passport, function, bucket, the rest.
3. Query facade backed by today's builders, with the result shaper hook. Controllers move over in domain batches.
4. Write facade backed by today's bucket CRUD helpers.
5. Repository interfaces and provider, with MongoDB repositories. One PR per domain group.
6. Change feed with the MongoDB change source. `watch()` callers move over in batches.
7. The import rule, once every caller has moved.

## Open questions

- Package names and locations for the layer and the MongoDB adapter.
- How fine-grained the facade is: one generic facade, or one per domain area such as buckets?

## Done when

- No code outside the MongoDB adapter, the devkit and `apps/migrate` imports MongoDB APIs or constructs `ObjectId`.
- All existing suites pass with unchanged assertions.

## As built

### Packages

| Package                        | Path                     | Contents                                                                                       |
| ------------------------------ | ------------------------ | ---------------------------------------------------------------------------------------------- |
| `@spica-server/interface-data` | `packages/interface/data` | Types and tokens of every contract. No runtime code, no MongoDB imports.                     |
| `@spica-server/data`           | `packages/data`          | `DataModule`, the `ids()` accessor, id pipes, `provideRepository`, `PassthroughResultShaper`, `InvalidIdError`, `DuplicateKeyError`. |
| `@spica-server/data-mongodb`   | `packages/data/mongodb`  | The MongoDB adapter: id type, facades, bucket read/write code, read profiles, every repository, the change feed. |

`packages/database/**` and `packages/interface/database` stay where they are and count as adapter zone. `apps/api/src/main.ts` is the only non-test file that imports `@spica-server/data-mongodb`.

### Contracts

| Contract             | As built                                                                                                                                                         |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Adapter registration | `DataModule.forRoot(adapter)` with `DataAdapter = {engine, module}`; `MongoDataAdapter.forRoot(uri, options)` and `MongoDataAdapter.forExistingConnection()`. `DATA_ENGINE` names the bound engine. |
| Id type              | `Id`, `IdType` (`parse`, `isValid`, `generate`, `is`, `equals`, `serialize`), `IdTypes` (`forCollection(name)`, `forBucket(bucketId)` (async), `unscoped()`), token `ID_TYPES`. Static code uses `ids()`. |
| Id param pipe        | `ID(collection)` for `@Param`, `idTransform(collection)` for composed pipes, `@DocumentId(documentParam, bucketParam)` for bucket documents. Invalid ids answer `400 Invalid id.` as before, and so does a `forBucket` that rejects, so an adapter that looks the bucket up can throw. |
| Query facade         | `COLLECTION_QUERY` (`CollectionQueryFacade.find/findOne/paginate(collection, ReadSpec, CountStrategy)`) and `BUCKET_QUERY` (`BucketQueryFacade`, in `interface-bucket-common`). `ReadSpec`: `id, resourceFilter, filter, filterReplacers, where, createdBetween, relations, fields, sort, skip, limit`. `CountStrategy`: `"estimate-unless-filtered" \| "exact"`. Relations resolve through per-collection read profiles in the adapter. |
| Write facade         | `BUCKET_WRITE` (`BucketWriteFacade.insert/replace/patch/delete`, in `interface-bucket-common`), with `returnDocument: "before" \| "after"`. |
| Repository pattern   | One `XRepository` interface and `X_REPOSITORY` token per domain in `packages/interface/<domain>`, bound with `provideRepository(X_REPOSITORY)` through the adapter's `REPOSITORY_CLASSES`. Tokens: refresh token, apikey, strategy, policy, identity, user, verification, function, function log, function log sink, function asset, webhook, webhook log, bucket, bucket data, history, dashboard, asset, activity, config, env var, secret, preference, status, storage, replication job and command. Unique index violations surface as `DuplicateKeyError`. |
| Change feed          | `CHANGE_FEED` (`ChangeFeed.watch(collection, {operations, document: "current", beforeChange: "whenAvailable"})`), emitting `ChangeEvent` in today's change stream shape; `_id._data` stays the replica dedupe key. |
| Result shaper hook   | `RESULT_SHAPER` (`ResultShaper.shape(resource, result)`); MongoDB binds `PassthroughResultShaper`, which returns the same reference. |

Also added: `COLLECTION_NAMES` (lists collections for the function trigger schema and webhooks) and `DATA_HEALTH` (the `/status/ready` ping).

### Answers to the open questions

- Packages: the three above.
- Facades: one per area. `CollectionQueryFacade` for system collections, `BucketQueryFacade` and `BucketWriteFacade` for bucket data.
- Import rule: `scripts/check-data-boundary.mjs`, run by `yarn check:data-boundary` and in CI after `nx sync:check`, with a fixture-based self-test. No ESLint was added.

### Differs from the plan

- `IdTypes.unscoped()` parses ids from client input before the resource is known: the core-schema `objectid` formats, the GraphQL `ObjectId` scalar and the bucket filter reviver.
- Tests register the adapter from the root `jest.setup.js`, because `database-testing` importing the adapter would make a project reference cycle.
- Specs that asserted MongoDB filter or update syntax on mocked services now assert the intent methods, and adapter tests pin the MongoDB shape. Specs whose subject moved into the adapter moved with it.
- `RealtimeDatabaseService` keeps its own change streams and initial snapshot. Realtime gateways may import `RealtimeDatabaseService` and `RealtimeDatabaseModule` from `@spica-server/database-realtime`.
- The import rule allowlists, with the part that removes each:
  - `bucket/expression` builtins and converter: ACL rules render to MongoDB filters with ObjectIds (Part 7).
  - `bucket/graphql/src/schema.ts`: GraphQL where arguments render to MongoDB filters (Part 8).
  - `storage/src/body.ts`: `application/bson` is a request body format, not database access.
- `resourceFilterFunction` in the action guard still builds `{_id: {$in}}` and `{_id: {$nin}}` itself. The import rule doesn't catch it because ids are parsed through `ids()` and nothing is imported from MongoDB. Part 7 moves it behind the adapter.
- `ChangeEvent` keeps MongoDB's change stream field names on purpose. Part 10 reworks the shape before the PostgreSQL source.
- The repository interfaces repeat operations such as `findById`, `insert` and `deleteById`. The shared base interface is the last PR of Part 3.
- `legacyPlan` in `packages/data/mongodb/test/collection-query.spec.ts` rebuilds the old `PipelineBuilder` plan to prove the facade changed nothing. Part 8 removes it.
- Behaviour edges:
  - apikey and webhook lists with `sort={}` or `limit=0` used to answer 500 and now succeed.
  - `Content-language` is no longer sent when a bucket read fails.
  - Webhook log `succeed` filters match by plain equality instead of `$eq`.
  - Asset `find` passes the client filter through unchanged; it does not gain the facade's id and date coercion.
  - Closing a change feed subscription closes its change stream without waiting for the close to finish.
  - `@ResourceFilter()` without an argument is tolerated and means the same as `{pure: true}`: the raw include and exclude lists.

