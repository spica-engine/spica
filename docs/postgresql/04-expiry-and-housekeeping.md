# Part 4: Expiry and housekeeping

## How to use this document

- Plan and implement only this part. Read the code from the parts under "Depends on" on master, along with their "As built" sections. Don't open the other documents in `docs/postgresql/`.
- If this part needs something a merged part doesn't provide, stop and list it under "Requests to other parts" in your plan instead of building it.
- Follow the PR breakdown. Each PR is either a behaviour-neutral refactor or new engine code, never both, and is small enough to review in one sitting.
- Existing MongoDB suites stay green. New code brings its own tests in the PostgreSQL CI job.
- After the last PR, fill in "As built".

## Purpose

Removes records that only matter for a while. MongoDB does this with TTL indexes. On PostgreSQL, the pg_cron extension runs the cleanup inside the database.

## Rules that apply

- Retention arguments keep their meaning on both engines.
- pg_cron runs inside PostgreSQL, so API replicas don't have to agree on which one runs the purge.

## Depends on

- **Part 2 (merged):** the PostgreSQL migration track, if the extension or job tables need setup there.
- **Part 3 (merged):** the system tables and their repositories.

## Provides

| Contract           | What later parts expect                                                                      |
| ------------------ | -------------------------------------------------------------------------------------------- |
| Expiry API         | A repository-level way to say "expire records older than N". A TTL index on MongoDB, a pg_cron job on PostgreSQL. |
| pg_cron available  | Enabled in the chart's PostgreSQL image and in the testing module.                          |

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
| Fallback purge  | If pg_cron isn't available on an external server, the API runs the same deletes on a schedule.              |

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
- Should large log tables be partitioned by time, so expiry drops whole partitions instead of deleting rows?

## Done when

- Every record type with a TTL today expires on PostgreSQL within the same retention.
- Changing a retention argument and restarting updates the job.

## As built

_Fill in after the last PR merges._
