# Part 2: System migrations

## How to use this document

- Plan and implement only this part. Read the code from the parts under "Depends on" on master, along with their "As built" sections. Don't open the other documents in `docs/postgresql/`.
- If this part needs something a merged part doesn't provide, stop and list it under "Requests to other parts" in your plan instead of building it.
- Follow the PR breakdown. Each PR is either a behaviour-neutral refactor or new engine code, never both, and is small enough to review in one sitting.
- Existing MongoDB suites stay green. New code brings its own tests in the PostgreSQL CI job.
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

## Done when

- The runner applies the PostgreSQL track on a fresh database and on an already-migrated one.
- MongoDB upgrades behave as today.

## As built

_Fill in after the last PR merges._
