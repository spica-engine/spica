# Part 8a: Controller writes

## How to use this document

- Plan and implement only this part. Read the code from the parts under "Depends on" on master, along with their "As built" sections. Don't open the other documents in `docs/postgresql/`.
- If this part needs something a merged part doesn't provide, stop and list it under "Requests to other parts" in your plan instead of building it.
- Follow the PR breakdown. Each PR is either a behaviour-neutral refactor or new engine code, never both, and is small enough to review in one sitting.
- Existing MongoDB suites stay green. A spec this part converts runs on both engines and passes on both. No spec is merged failing.
- After the last PR, fill in "As built".

## Purpose

Part 8 made reads work on PostgreSQL. This part makes the writes of the system-domain controllers work there too, and finishes Part 8's rule that every spec of a domain it enables runs through `contractSuite` or declares `mongoOnly("reason")`.

**Part 8 cannot be completed before this part, and Part 9 depends on it.** `POST /env-var` already shows why: it answers without an `_id` on PostgreSQL, so the system-domain controller specs, which create their data through the controllers, cannot run there.

## Rules that apply

- Controllers and CRUD helpers stay engine-agnostic. They use what a repository returns, never the object they passed in.
- A repository does not copy a MongoDB driver quirk. The fix is in the caller.
- A spec is converted to `contractSuite` and passes on both engines, or it declares `mongoOnly("reason")`. The reason names the missing feature and the part that owns it. "Not ready yet" is not a reason.
- No part is accepted with a failing test.

## Depends on

- **Part 3 (merged):** the PostgreSQL system repositories.
- **Part 8:** the query facade the controllers read through.

## Provides

| Contract                    | What later parts expect                                                                              |
| --------------------------- | ---------------------------------------------------------------------------------------------------- |
| Engine-neutral CRUD helpers | A system-domain write answers with the stored record on both engines.                                 |
| Converted system specs      | Parts 9 and 10 extend specs that already run on both engines instead of converting them.              |

## Not this part

- Bucket data writes (Part 9) and their specs.
- Realtime and change feeds on PostgreSQL (Part 10) and their specs.
- The admin panel (Part 12).

## Today

### Bugs: the helper returns the input, not the stored record

`Insertable.insert()` already returns the stored entity (`packages/interface/data/src/entity-repository.ts`). MongoDB's `BaseCollection.insertOne` also mutates the object it is given (`doc._id = insertedId`), and these helpers rely on that. The PostgreSQL ORM returns a new record and leaves the input alone.

| Domain      | Location                                            | Effect on PostgreSQL                       |
| ----------- | --------------------------------------------------- | ------------------------------------------ |
| env var     | `packages/api/env_var/src/crud.ts:55-56`            | `POST /env-var` answers without `_id`      |
| dashboard   | `packages/api/dashboard/src/crud.ts:23-24`          | `POST /dashboard` answers without `_id`    |
| bucket      | `packages/api/bucket/src/crud.ts:32-36`             | `POST /bucket` answers without `_id`       |

Second-order effect: the activity interceptor builds the activity record inside an async `tap`, and the resource builders of env var and bucket do `res._id.toString()` (`env_var/src/activity.resource.ts:12`, `bucket/common/src/activity.resource.ts:11`). On PostgreSQL they throw, the activity record is lost and the rejection is unhandled.

Everything else the survey checked (secret, function, webhook, identity, user, apikey, policy, strategy, asset, preference, storage, activity) already uses the returned value or sets `_id` itself.

### Smaller differences

| Item | Detail | Proposal |
| ---- | ------ | -------- |
| Policy update | `replaceById` returns a count and the helper answers 404 for 0. MongoDB's is `matchedCount` (not `modifiedCount`, as first thought), so an identical `PUT` already answers 200 there; PostgreSQL returns 1 whenever the row exists. The response body is the number, not the policy. | Nothing to change. A spec pins it on both engines. |
| API key duplicate | The MongoDB repository does not call `translateWriteError`, so a duplicate `key` is a raw driver error. PostgreSQL throws `DuplicateKeyError`. | Translate it on MongoDB, so both throw `DuplicateKeyError`. |
| Storage `insertAll` | `storage.service.insert` matches the returned rows to its input by index. PostgreSQL's `INSERT … RETURNING` keeps the order in practice, not by contract. | Match by the unique `name`. |
| Webhook invoker | `logs.insert(...)` is fire-and-forget with no `.catch` (`invoker.ts:79`, `:109`). A failing insert is an unhandled rejection. | Catch and log. |
| Asset list filter | `PostgresAssetRepository.find(filter)` throws for any non-empty filter. This is a read, so it belongs to Part 8's reads. | Take the expression filter, like the storage browse. |
| Function merge patch | The repository interface takes a MongoDB `$set` / `$unset` update document and PostgreSQL replays it by hand. | Not a bug. Note it in "As built". |
| `bucket.controller.ts:36` | Imports `getUpdateQueryForPatch` and does not use it. | Remove the import. |

### Specs

`node scripts/check-engine-specs.mjs` lists 117 specs that use the MongoDB testing module without `contractSuite` or `mongoOnly`: 103 under `packages/api`, 13 under `packages/data/mongodb/test` (MongoDB's own, they stay) and 1 under `packages/database/realtime`.

| Directory      | Specs | Lines  |
| -------------- | ----- | ------ |
| activity       | 2     | 426    |
| asset          | 1     | 953    |
| bucket         | 27    | 10,065 |
| config         | 1     | 321    |
| dashboard      | 3     | 564    |
| env_var        | 3     | 727    |
| function       | 26    | 7,514  |
| passport       | 26    | 11,429 |
| preference     | 3     | 326    |
| replication    | 3     | 264    |
| secret         | 3     | 791    |
| status         | 2     | 229    |
| storage        | 3     | 2,682  |

## Decisions needed

1. **Policy `PUT`.** Settled without a decision: the survey misread MongoDB's repository. `replaceById` returns `matchedCount` there, so an identical `PUT` was never a 404 on either engine, and the body stays the number. The options that were listed (change MongoDB, return the policy, make PostgreSQL report 0) were not needed.
2. **Which specs belong to this part.** Recommended split:
   - *Converted here:* every spec of a system domain whose behaviour exists on PostgreSQL after Part 8 (reads) and this part (writes).
   - *`mongoOnly` with a named part:* bucket data, GraphQL and bucket-common data specs ("needs bucket data writes on PostgreSQL, Part 9"); realtime and change feed specs ("realtime on PostgreSQL, Part 10"); function enqueuer, runtime database and webhook invoker change-stream specs (Part 10); profiler specs ("the profiler reads MongoDB's `system.profile`; PostgreSQL has no equivalent").
   - Those reasons are true today and each marker is removed by the part it names.

## Target architecture

No new components. The helpers return the repository result, the repositories translate their errors the same way, and the specs run on both engines.

## What changes

- **CRUD helpers:** env var, dashboard and bucket return what the service returns.
- **Repositories and services:** the smaller items above.
- **Specs:** converted in batches by domain, with one `mongoOnly` reason per spec that cannot be.

## PR breakdown

1. Fix the three CRUD helpers (env var, dashboard, bucket schema) and the activity records they feed, with a spec per helper that runs on both engines. First, because every later conversion needs it.
2. The policy `PUT` contract (a spec; see decision 1).
3. The smaller items: API key duplicate, storage `insertAll` order, webhook invoker catch, asset list filter, the unused import.
4. Test support: the storage helpers move to `@spica-server/database-testing`.
5. Convert the small domains.
6. Convert passport.
7. Convert function.
8. Convert storage and the bucket schema specs.
9. Classify what is left with `mongoOnly("reason")` and run `yarn check:engine-specs --strict --under=<dir>/` for every directory above.

Order: 1 to 4 first. 5 to 8 are independent of each other. 9 last. The conversions found seven problems that were not in the survey; each went into its own PR (see "As built").

## Open questions

- **Specs that need external services** (RabbitMQ, gRPC): they run in CI with those services. Do they convert, or stay `mongoOnly("needs RabbitMQ")`? They exercise the function engine, not the database, so converting adds little.
- **Specs that seed raw collections** (`db.collection("identity").deleteMany({identifier: {$ne: "spica"}})` and similar): switch them to the repository interfaces, or keep the raw seeding in an engine-specific helper?
- **Run time.** Running every converted spec on both engines roughly doubles their CI time. Split the PostgreSQL run into its own job?

## Done when

- `POST /env-var`, `/dashboard` and `/bucket` answer with the stored record on both engines, and their activity records are written.
- `node scripts/check-engine-specs.mjs --strict` lists nothing for the directories above.
- Every converted spec passes on both engines, with no skipped test standing in for a failure.
- Every `mongoOnly` reason names a feature and the part that owns it.
- Part 8's document no longer lists the controller writes under "Left for other parts".

## As built

### The planned items

- **CRUD helpers (#2158):** `crud.insert` of env var, dashboard and bucket returns what the service returns, so `POST` answers with `_id` on both engines and the activity record is written. A spec per helper runs on both engines. The unused `getUpdateQueryForPatch` import is gone.
- **Policy `PUT` (#2159):** only a spec. MongoDB already returned `matchedCount`, so the "identical `PUT` is a 404" claim above was wrong (see decision 1).
- **Smaller items (#2160):** the MongoDB API key repository translates a duplicate `key` to `DuplicateKeyError`; `storage.service.insert` matches the inserted rows by `name`; the webhook invoker records its logs through `record()`, which catches and logs; `GET /asset` takes the `FILTER` pipe, and `PostgresAssetRepository.find` takes an expression.
- **Test support (#2161):** `clearStorage` and `waitForMongoIndexes` live in `@spica-server/database-testing`. The planned engine-neutral reset, shared-database `connect` and time-ordered id fixture were not needed. The conversions added `idAt` (an id of a given time), `ensureCollections` and `QuietChangeFeedModule` (a change feed that never emits, for specs that do not test it).

### Found while converting

Each of these was a real gap, found by a spec that passed on MongoDB, and went into its own PR:

- **#2164, the activity resource filter.** The panel sent `resource={"$all":[...],"$in":[...]}`, MongoDB operators in a public parameter. The API now takes `resource` (repeated: values the resource list holds) and `documentId` (repeated: ids of which it holds any). The query facade gets a `contains` condition (`$all`/`$in` on MongoDB, `@>`/`&&` on PostgreSQL). The panel changed in the same PR.
- **#2166, the status providers.** `GET /status/:module` answered with the first provider ever registered in the process. They are keyed by module now.
- **#2168, `setOption(name, undefined)`.** It emptied the options of the whole module on PostgreSQL; it stores a JSON `null` now, like MongoDB.
- **#2169, the strategy lists.** The identity and user strategy lists passed a MongoDB filter object and answered an empty list on PostgreSQL. They use a `where` condition now.
- **#2170, filters on hashed fields.** `email` and `phone` of a user and the `token` of a refresh token are stored as hashes. `ReadSpec.hashed` (`{secret, fields}`) declares them, MongoDB rewrites the filter object and PostgreSQL hashes the literals of an expression, so both engines filter by the plain value. The controller-level replacers are gone.

### Conversions

- **Small domains (#2167):** activity, asset, config, dashboard, env var, preference, replication reducer and secret.
- **Passport (#2171):** 18 specs, plus the CRUD half of `identity.controller` (the profiler describe is `identity.profiler.spec.ts`).
- **Function (#2173):** `engine`, `plan-executor`, the scheduler, the function log controller and the webhook specs that do not need the change feed. The scheduler takes `CHANGE_FEED`, so these specs import `QuietChangeFeedModule`.
- **Storage and bucket schema (#2174):** storage (3), bucket cache (2), the schema of the hook module and `bucket.schema.resolver`.

57 specs under `packages/api` run through `contractSuite`, some of them converted before this part.

### Classified `mongoOnly` (55)

| Reason | Specs | Removed by |
| ------ | ----- | ---------- |
| Realtime, change feed triggers and commands, `FunctionModule`, RabbitMQ and gRPC (these also need `FunctionModule`) | 27 | Part 10 |
| `BucketModule` needs `BUCKET_DATA_REPOSITORY` on PostgreSQL: bucket data, encrypted, hash and rule specs, GraphQL, `bucket.controller`, `bucket.module`, `bucket.service`, `bucket.e2e`, history, the hook factory and `preference.integration` | 22 | Part 9 |
| The profiler reads MongoDB's `system.profile` | 3 | stays |
| MongoDB TTL index inspection (`log/service`, `webhook/log.service`); PostgreSQL expires rows with the pg_cron job of Part 4 | 2 | stays |
| `passport/test/identity.e2e.spec.ts` is an `xdescribe` since 2024 and fails when enabled | 1 | decide: fix or delete |

The 13 specs under `packages/data/mongodb/test` are MongoDB's own and stay unclassified. `yarn check:engine-specs --strict --under=packages/api/` lists nothing.

### Notes

- **Function merge patch:** the repository takes a MongoDB `$set`/`$unset` update document, and PostgreSQL replays it by hand. Not a bug; it stays this way.
- **Specs share a process:** the status provider registry (fixed in #2166) and the asset `validators`, `operators` and `exporters` registries outlive a module, so specs that install assets clear them after each module.
- **MongoDB in local runs:** without `MONGODB_URL`, each MongoDB module starts a container that lives until the run ends, which overloads Docker on specs with many modules. CI uses one shared server through `MONGODB_URL`; set it locally to the same effect.
- **Plan versus built:** the plan counted the bucket schema, history and service specs as convertible. They build `BucketModule` or `BucketService`, which need the bucket data repository, so they are classified for Part 9.
