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

_Fill in after the last PR merges: package names, contract names, anything that differs from this plan._
