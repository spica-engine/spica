# Part 4: Expiry and housekeeping

## How to use this document

- Plan and implement only this part. Read the code from the parts under "Depends on" on master, along with their "As built" sections. Don't open the other documents in `docs/postgresql/`.
- If this part needs something a merged part doesn't provide, stop and list it under "Requests to other parts" in your plan instead of building it.
- Follow the PR breakdown. Each PR is either a behaviour-neutral refactor or new engine code, never both, and is small enough to review in one sitting.
- Existing MongoDB suites stay green. New code brings its own tests, which run on PostgreSQL in CI. Shared behaviour uses contract suites.
- After the last PR, fill in "As built".

## Purpose

Removes records that only matter for a while. MongoDB does this with TTL indexes. On PostgreSQL, the pg_cron extension runs the cleanup inside the database.

## Rules that apply

- Retention arguments keep their meaning on both engines.
- pg_cron runs inside PostgreSQL, so API replicas don't have to agree on which one runs the purge.

## Depends on

- **Part 2 (merged):** the PostgreSQL migration track. It runs as `root`, but only on upgrades and not on new installs. The API creates tables at startup as `spica`, which cannot create `pg_cron`.
- **Part 3 (merged):** the system tables and their repositories.

## Provides

| Contract           | What later parts expect                                                                      |
| ------------------ | -------------------------------------------------------------------------------------------- |
| Expiry API         | A repository-level way to say "expire records older than N". A TTL index on MongoDB, a pg_cron job on PostgreSQL. |
| pg_cron available  | Enabled in the chart's PostgreSQL image and in the testing module. Both use the stock `postgres:18` today, which has no `pg_cron`, so this part picks or builds an image that does. Creating the extension needs the `root` superuser, because `pg_cron` is not a trusted extension. |

## Not this part

- Expiry for bucket data. Spica has none today.

## Scope

Records with TTL today:

- activities
- status entries
- function logs
- webhook logs
- refresh tokens
- user verifications
- replication commands and jobs

## Today

- These services call `upsertTTLIndex` on `created_at`, or create other expiry indexes, when they start. After Part 0 this sits behind their MongoDB repositories.
- Retention comes from startup arguments.

## Target architecture

### Components

| Component       | Responsibility                                                                                              |
| --------------- | ----------------------------------------------------------------------------------------------------------- |
| Expiry API      | Part of the repository contract. Each repository declares its retention at startup.                         |
| MongoDB side    | Upserts the TTL index, as today.                                                                             |
| pg_cron jobs    | One job per table, created or updated at startup, deleting rows older than the retention.                   |
| Fallback purge  | If pg_cron isn't available on the server, for example a managed service the API reaches through `--database-uri` (the chart has no external-server option), the API runs the same deletes on a schedule. |

### Flow

1. The API starts with its retention settings.
2. Each repository declares its retention.
3. On MongoDB, the TTL index is upserted. On PostgreSQL, the pg_cron job is upserted.
4. pg_cron deletes expired rows on schedule.

## What changes

- **Repositories:** the TTL setup moves into the expiry API.
- **Chart and testing module:** the PostgreSQL image and the throwaway database enable pg_cron.
- **API:** gets the fallback purge.

## PR breakdown

1. Expiry API on the repository contract, backed by today's TTL indexes. This is a behaviour-neutral refactor.
2. pg_cron enabled in the chart image and the testing module.
3. pg_cron jobs for every TTL domain.
4. Fallback purge when pg_cron is missing.

## Open questions

- Does the fallback purge need a leader so only one replica runs it, or are repeated deletes harmless enough?
- Who creates the `pg_cron` extension? It needs `root`. New installs run no migration, and the API runs as `spica`, so a migration alone cannot do it. The chart's init script (which runs as `root` when the database is created) is the likely place, with a Part 2 migration for upgraded installs that predate it. The `spica` role also needs permission to schedule jobs.
- Should large log tables be partitioned by time, so expiry drops whole partitions instead of deleting rows?

## Done when

- Every record type with a TTL today expires on PostgreSQL within the same retention.
- Changing a retention argument and restarting updates the job.

## As built

Three PRs landed. The fallback purge (PR 4 above) was dropped on purpose: pg_cron is required, and the API fails to start with a clear error when it is missing.

### Expiry API

- `ExpiringRepository.applyExpiry()` in `@spica-server/interface-data`. The eight repository interfaces that expire records extend it: activities, status, function logs, webhook logs, refresh tokens, verifications, replication commands and jobs.
- `provideRepository` awaits `applyExpiry()` right after creating a repository, so a failure stops startup instead of becoming an unhandled promise.
- MongoDB repositories moved their `upsertTTLIndex` and `createIndex` calls from the collection constructor into `applyExpiry()`. `upsertTTLIndex` now creates the collection first, because the constructor used to.
- PostgreSQL repositories call `PostgresExpiry.expire(entity, property, afterSeconds)` with the same option the Mongo twin reads, so changing a retention argument and restarting updates the job. Refresh tokens expire at `expired_at` with 0 seconds, and verifications fall back to 300 seconds like Mongo.

### pg_cron jobs

- `PostgresExpiry` (`packages/data/postgresql/src/expiry`) schedules one job per table, named `spica:<database>:<table>`, running every minute. Scheduling the same name again updates the job in place. An advisory lock in the cron database serializes replicas that start together.
- Every expiry column has a btree index, so the purge is an index range scan, which is what MongoDB's TTL index gives. Part 4 added the missing `created_at` indexes on `statuses` and `verifications`.
- The job command comes from `expireSql` in the ORM: `DELETE FROM "<table>" WHERE "<column>" < now() - make_interval(secs => N)`. The retention is validated as a non-negative integer because it is written into the SQL text.
- The cron database is read from `cron.database_name`. `PostgresExpiry` opens a short-lived connection to it and calls `cron.schedule_in_database(name, schedule, command, current database)`. The job runs as the role that scheduled it. Passing a `username` argument is rejected for non-superusers, so it is left out.

### Image, chart, testing module

- `docker/postgres` is `postgres:18` plus `postgresql-18-cron`, with `shared_preload_libraries=pg_cron` and `cron.use_background_workers=on`. It creates the extension in `$POSTGRES_DB` at initdb. `release.yml` publishes it as `spicaengine/postgres:18` and `18-<version>`.
- By default only a superuser may call `cron.schedule_in_database`. The chart's init script creates the extension and grants the `spica` role `USAGE` on schema `cron` and `EXECUTE` on that function. The ConfigMap mounted at `/docker-entrypoint-initdb.d` hides the image's own initdb script, which is why the chart repeats `CREATE EXTENSION`.
- `database.postgresImage` sets the image. The CLI starts `spicaengine/postgres` with `cron.database_name` set to the project database. The testing module builds `docker/postgres` through testcontainers; `TESTONLY_POSTGRES_IMAGE_CONTEXT` is set in `jest.setup.js`. CI builds the same image for the PostgreSQL matrix.

### Open questions

- Leader for the fallback purge: not applicable, there is no fallback.
- Who creates `pg_cron`: the image's initdb script for plain containers and the chart's init script. There is no upgrade path, because PostgreSQL support was unreleased.
- Partitioning of large log tables: not done. The purge is one `DELETE` per minute per table, which stays cheap in the steady state because every timestamp column is indexed. A large retention cut deletes its backlog in one statement.

