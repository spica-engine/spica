# Part 14: Query profiling

## How to use this document

- Plan and implement only this part. Read the code from the parts under "Depends on" on master, along with their "As built" sections. Don't open the other documents in `docs/postgresql/`.
- If this part needs something a merged part doesn't provide, stop and list it under "Requests to other parts" in your plan instead of building it.
- Follow the PR breakdown. Each PR is either a behaviour-neutral refactor or new engine code, never both, and is small enough to review in one sitting.
- Existing MongoDB suites stay green. New code brings its own tests, which run on PostgreSQL in CI. Shared behaviour uses contract suites.
- After the last PR, fill in "As built".

## Purpose

Gives PostgreSQL an equivalent of the MongoDB profiler. The MongoDB profiler records each slow operation in `system.profile`, with its duration, command, keys and documents examined and plan. The API exposes it as `GET /bucket/:id/data/profile`, `/passport/identity/profile` and `/passport/user/profile`, and the admin panel's Observability page reads those. On PostgreSQL the endpoints answer an empty list and the panel hides the page (Part 12).

PostgreSQL has no single per-operation profile table. This part builds the part of it that PostgreSQL offers without extra infrastructure: per-statement statistics from `pg_stat_statements`.

## Rules that apply

- **Same endpoints, engine-native details.** The three profile endpoints stay. On PostgreSQL they answer statement statistics, not MongoDB-shaped entries, and a filter is written in the expression language (README ground rules).
- **No new infrastructure.** The part uses what the PostgreSQL image already ships. Slow-query logs and plans are an operations topic, described below and not built here.
- **The server tells the client whether it works.** The extension may be missing (an external server given with `--database-uri`) or unreadable by the `spica` role. The panel never guesses from the engine name.
- **PostgreSQL has no existing installs** (README decision). There is no migration for the extension, only the image and the chart.

## Depends on

- **Part 1 (merged):** the PostgreSQL image, the chart, the testing container and the version check.
- **Part 5 (merged):** bucket table naming (`bucket_<id>` and its child tables), to attribute statements to a bucket.
- **Part 12 (PR 7 merged):** the panel's `isFeatureAvailable("profiler", engine)` gate and the Observability page. The panel step of this part is Part 12's PR 14.

## Provides

| Contract                  | What later work expects                                                              |
| ------------------------- | ------------------------------------------------------------------------------------ |
| Profiler capability       | `GET /status/engine` reports whether statement statistics can be read.               |
| `ProfilerStatement`       | One entry type for the three profile endpoints on PostgreSQL.                        |
| Profiler on PostgreSQL    | The Observability page lists the slowest and most frequent statements.               |

## Not this part

- Individual slow executions and their plans. They come from the PostgreSQL log (`log_min_duration_statement`, `auto_explain`), which needs a log pipeline.
- Resetting the statistics. `pg_stat_statements_reset()` needs a grant the `spica` role does not have, and the panel offers no button for it.
- Converting statements into MongoDB profiler entries. The engines differ, and the contract follows the engine.

## Options considered

What teams use to profile PostgreSQL:

| Need                                        | Tool                                                           | Notes                                                                                                                      |
| ------------------------------------------- | -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Which statements cost the most              | `pg_stat_statements`                                           | The standard. An extension loaded with `shared_preload_libraries`. Aggregates by normalized query: calls, total, mean, min, max and stddev time, rows, buffer hits and reads, WAL. Queryable as a view. Not per execution. |
| Individual slow executions                  | `log_min_duration_statement`, `log_min_duration_sample`        | The built-in counterpart of the profiler's threshold. Output goes to the log; `log_destination = jsonlog` (15+) is easy to ingest. |
| The plan of those executions                | `auto_explain`                                                 | Logs `EXPLAIN` (optionally `ANALYZE`, buffers) over a threshold. The closest match to the profiler's plan data.            |
| What is running now                         | `pg_stat_activity`, `pg_locks`, `pg_blocking_pids()`           | A live view, not history.                                                                                                  |
| Where time goes                             | `track_io_timing`, `pg_stat_io`, `pg_wait_sampling`            | I/O and wait events.                                                                                                       |
| Time-windowed aggregates with plans         | `pg_stat_monitor` (Percona)                                    | Builds on `pg_stat_statements`. Not in the stock image.                                                                    |
| One statement                               | `EXPLAIN (ANALYZE, BUFFERS)`                                   | Manual.                                                                                                                    |
| Managed or paid                             | pganalyze, Datadog Database Monitoring, RDS Performance Insights, Cloud SQL Query Insights | They collect the same views, add history and alerts. |
| The application side                        | OpenTelemetry spans around queries                             | Per request, not the database's own view.                                                                                  |

## Decisions

1. **What the API exposes.** Per-statement statistics from `pg_stat_statements`. It ships in the stock `postgres:18` image, needs only a preload setting and one `CREATE EXTENSION`, and is readable as SQL. Per-execution entries need log ingestion and stay out.
2. **Entry shape.** Engine-native, not MongoDB-shaped:
   - `queryId` (string), `query` (normalized text)
   - `calls`, `totalTimeMs`, `meanTimeMs`, `minTimeMs`, `maxTimeMs`, `stddevTimeMs`
   - `rows`, `sharedBlocksHit`, `sharedBlocksRead`, `tempBlocksWritten`, `walBytes`
   - `statsSince` (ISO date)
3. **How the panel learns the profiler is available.** `GET /status/engine` (authenticated) gains `features: {profiler: boolean}`. It is `true` only when the extension is loaded, created in the database and readable by the `spica` role. The alternative, probing a profile endpoint and treating `501` as "off", adds no field but puts a failed request in every page load. Recommended: the field.
4. **Attribution.** Statements are matched to a bucket, identities or users by the table name in the normalized text (`bucket_<id>` and its child tables, `identities`, `users`), and limited to the API's own database and role.
5. **Filter and sort.** A filter is an expression over the entry's fields (`document.meanTimeMs > 50 && regex(document.query, "bucket_", "i")`). The sortable fields are `totalTimeMs`, `meanTimeMs`, `maxTimeMs`, `calls` and `rows`. Default: `totalTimeMs` descending. Fields are a fixed list, never pasted into SQL.
6. **Settings.** `shared_preload_libraries=pg_cron,pg_stat_statements`, `compute_query_id=on`, `pg_stat_statements.track=all`, `pg_stat_statements.max=5000`. `track_io_timing` stays off: it costs time on every read.

## Target architecture

### Components

| Component               | Responsibility                                                                                                  |
| ----------------------- | --------------------------------------------------------------------------------------------------------------- |
| Image, chart, test container | Load the extension and create it in the application database.                                              |
| `ProfilerCapability`    | At boot, checks that the extension answers a `SELECT` for the `spica` role. Feeds `features.profiler`.          |
| `StatementProfiler`     | Reads `pg_stat_statements` for one table family, with the expression filter, sort and paging. In `data-postgresql`. |
| Profile endpoints       | The three existing endpoints call the repositories' `profilerEntries`, which now answer statements on PostgreSQL. |
| Panel                   | The profiler gate reads `features.profiler`. The Observability page draws a statements table on PostgreSQL.      |

## What changes

- **Image and chart:** the preload list and settings, `CREATE EXTENSION pg_stat_statements` in the application database (the chart's init script already runs as the superuser and creates the application database), and the same in the test container.
- **API:** the capability check, the reader, and the three PostgreSQL `profilerEntries` implementations that now return statements.
- **Panel:** the profiler becomes available on PostgreSQL when the server says so.

## PR breakdown

1. **Provisioning** (behaviour-neutral for the API). Image `CMD` and settings, init script and chart, and the testing container, so `pg_stat_statements` exists in every PostgreSQL environment.
2. **Capability.** `ProfilerCapability` and `features.profiler` on `GET /status/engine`, with a test that is `false` when the extension is missing.
3. **Reader.** `StatementProfiler` and `ProfilerStatement`, with contract tests for the filter, sort, paging and table attribution.
4. **Endpoints.** The three PostgreSQL `profilerEntries` return statements; contract tests replace the empty-list stubs.
5. **Panel (listed in Part 12, PR 14).** The profiler gate reads `features.profiler` instead of the engine name, and the Observability page shows a statements table on PostgreSQL. This PR starts only after PR 4 has merged.
6. **Docs.** "As built", the README row, and the operations note on logs and `auto_explain`.

Order: 1, then 2 and 3 in either order, then 4, then 5. 6 is last.

## Open questions

- **Managed PostgreSQL.** Providers load `pg_stat_statements` differently and some limit role access. If the `spica` role cannot read it, `features.profiler` is `false` and the panel stays hidden. Should the page say why?
- **Statistics size.** `pg_stat_statements.max` bounds memory. Is 5000 enough for an instance with many buckets, each with its own tables?
- **Operations note.** Where do the log settings (`log_min_duration_statement`, `auto_explain`, `jsonlog`) live: the chart values or only this document?

## Done when

- On a PostgreSQL instance with the image's defaults, `GET /bucket/:id/data/profile` lists statements that touched that bucket, ordered by total time, filtered and paged.
- `GET /status/engine` reports `features.profiler`, and it is `false` on a server without the extension.
- The panel's Observability page works on PostgreSQL, and is hidden when the server reports the profiler off.
- MongoDB behaves as before.

## As built

_Fill in after the last PR merges._
