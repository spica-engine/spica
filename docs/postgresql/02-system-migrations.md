# Part 2: System migrations

## How to use this document

- Plan and implement only this part. Read the code from the parts under "Depends on" on master, along with their "As built" sections. Don't open the other documents in `docs/postgresql/`.
- If this part needs something a merged part doesn't provide, stop and list it under "Requests to other parts" in your plan instead of building it.
- Follow the PR breakdown. Each PR is either a behaviour-neutral refactor or new engine code, never both, and is small enough to review in one sitting.
- Existing MongoDB suites stay green. New code brings its own tests, which run on PostgreSQL in CI. Shared behaviour uses contract suites.
- After the last PR, fill in "As built".

## Purpose

Gives PostgreSQL a versioned migration track for Spica's own tables. It runs at deploy time and in tests, never at runtime. Later parts add their tables to this track.

## Rules that apply

- One engine per instance. The migrate runner picks the track for the running engine.
- The PostgreSQL track is plain SQL migration files, so reviewers read the actual table changes.
- The MongoDB track must not change.

## Depends on

- **Part 1 (merged):** `--database-type`, the PostgreSQL connection settings, and the testing module engine option.

## Provides

| Contract                 | What later parts expect                                                                               |
| ------------------------ | ----------------------------------------------------------------------------------------------------- |
| PostgreSQL track         | A place to add a numbered SQL migration that the runner applies in order.                             |
| Version record           | The track records which versions have been applied.                                                   |
| Test integration         | The PostgreSQL testing module applies the track to every throwaway database.                         |
| Deploy integration       | The chart's migrate job runs the right track for the engine.                                          |

## Not this part

- Creating system tables. Part 3 adds them as migrations on this track.
- Bucket tables. The schema manager creates those at runtime.
- pg_cron jobs. Part 4 creates them.

## Today

- `apps/migrate` runs versioned scripts, from `0.5.2` up to `0.19.x`, against MongoDB, using an index file of versions.
- The chart runs it as a migrate job (`migrate.yaml`) on upgrade.

## Target architecture

### Components

| Component         | Responsibility                                                                                     |
| ----------------- | -------------------------------------------------------------------------------------------------- |
| Migrate runner    | Same entry point. It reads the engine and picks a track.                                           |
| MongoDB track     | Today's scripts, unchanged.                                                                         |
| PostgreSQL track  | Numbered SQL files, starting with an empty baseline. It's applied in order inside transactions, and each version is recorded. |

### Flow

1. A deploy or a test suite starts the runner with the engine settings.
2. The runner picks the track.
3. The PostgreSQL track applies pending versions in order and records them.
4. The API starts against the migrated database.

## What changes

- **`apps/migrate`:** gets an engine switch and the PostgreSQL track.
- **The chart's migrate job:** receives the engine and PostgreSQL settings.
- **The PostgreSQL testing module:** applies the track.
- **Every later PR that changes a system interface:** ships a migration for both tracks.

## PR breakdown

1. Engine switch in `apps/migrate`, as a behaviour-neutral refactor: MongoDB runs exactly as today.
2. PostgreSQL track runner, version record and empty baseline.
3. Testing module applies the track.
4. Chart migrate job gets the engine settings.

## Open questions

- Should the API refuse to start when the PostgreSQL track is behind the release, or run pending migrations itself?
- Which role runs the PostgreSQL track: `spica`, which owns the database, or `root`, the superuser? Part 1's chart creates both. Extensions such as `pg_cron` need `root`.

## Done when

- The runner applies the PostgreSQL track on a fresh database and on an already-migrated one.
- MongoDB upgrades behave as today.

## As built

- **Engine switch:** `apps/migrate` takes `--database-type` (`mongodb` default, or `postgresql`). `--database-name` is required only for MongoDB. The MongoDB track is unchanged.
- **Shared runner:** the PostgreSQL runner, manifest and SQL live in `@spica-server/data-postgresql-migrations` (`packages/data/postgresql-migrations`), not in `apps/migrate`. `apps/migrate` already references `database-testing`, so the testing module importing the runner from the app would have been a circular project reference. `apps/migrate` only adds credential handling (`POSTGRES_USERNAME`/`POSTGRES_PASSWORD`) and the test lookup override.
- **Adding a migration:** add `src/migrations/<version>/<name>.sql` in that package and list it in `src/migrations/index.json` (version to relative paths). The `copy-assets` target copies the SQL into `dist`.
- **Selection:** same model as the MongoDB track. The runner gets `--from` and `--to` release versions and applies the versions in `(from, to]`; with none in range it does nothing. Because of this, the API neither checks nor runs migrations at startup (the first open question is closed that way).
- **Version record:** table `spica_migrations(version text primary key, scripts text[], applied_at timestamptz)`, created by the runner. A recorded version is skipped, so re-running on a migrated database is a no-op.
- **Transaction:** one transaction for the whole run (all or nothing), so `--dry-run` rolls back across versions. A transaction-level advisory lock serialises concurrent runs. Statements that cannot run in a transaction (for example `CREATE INDEX CONCURRENTLY`) are not supported on this track.
- **Baseline:** an empty `0.21.0` (`SELECT 1;`). The version is the next minor after the latest tag at the time (0.20.2) and should be confirmed at release.
- **Testing module:** `createPostgresDatabase` (and `DatabaseTestingModule.postgres`) applies the track to every throwaway database. `createPostgresDatabase(name, {migrate: false})` returns an empty database; the migrate runner's own tests use it.
- **Chart:** the pre-upgrade migrate job renders for both engines. For PostgreSQL it passes `--database-type postgresql`, no `--database-name`, and the `root` role's credentials (second open question: `root`, because `pg_cron` needs it). Objects created by `root` migrations must be owned by or granted to `spica`; Part 3 must follow this.
- **Not done:** `apps/cli` `project upgrade` still assumes MongoDB. Docker image contents (`pg` and the SQL inside the migrate image) were not built or checked.
