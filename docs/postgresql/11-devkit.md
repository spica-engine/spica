# Part 11: Devkit

## How to use this document

- Plan and implement only this part. Read the code from the parts under "Depends on" on master, along with their "As built" sections. Don't open the other documents in `docs/postgresql/`.
- If this part needs something a merged part doesn't provide, stop and list it under "Requests to other parts" in your plan instead of building it.
- Follow the PR breakdown. Each PR is either a behaviour-neutral refactor or new engine code, never both, and is small enough to review in one sitting.
- Existing MongoDB suites stay green. New code brings its own tests, which run on PostgreSQL in CI. Shared behaviour uses contract suites.
- After the last PR, fill in "As built".

## Purpose

Lets function code talk to PostgreSQL directly. On MongoDB instances, `@spica-devkit/database` keeps handing out a MongoDB client. PostgreSQL instances get a completely new devkit package, designed for SQL rather than modelled on the MongoDB one.

## Rules that apply

- The new devkit has its own API. It doesn't imitate `@spica-devkit/database`.
- `@spica-devkit/bucket` needs nothing special. On PostgreSQL, callers write the filter in SQL and the API handles it.
- The experimental devkit database cache loads the new devkit on PostgreSQL instances.

## Depends on

- **Part 1 (merged):** the engine argument and the PostgreSQL connection settings.
- **Part 5 (merged):** table metadata, so the devkit can expose bucket table names.

## Provides

| Contract           | What later parts expect                                                         |
| ------------------ | ------------------------------------------------------------------------------- |
| New devkit package | Published with the other devkit packages on each release.                       |
| Runtime engine env | Workers know the engine and the PostgreSQL connection settings.                 |

## Not this part

- The other devkit packages (auth, identity, storage, sync, testing). They use the REST API.

## Today

- The function scheduler passes the MongoDB URL, database name and replica set to workers as internal environment variables.
- `@spica-devkit/database` connects with the MongoDB driver, keeps one connection per worker, and exports `database()`, `close()` and `ObjectId`.
- With `--experimental-function-devkit-database-cache`, the worker bootstrap preloads the database devkit before the first event.
- The release workflow publishes the devkit packages to npm through trusted publishers.

## Target architecture

### Components

| Component             | Responsibility                                                                                          |
| --------------------- | ------------------------------------------------------------------------------------------------------- |
| Runtime environment   | The scheduler also passes the engine type and the PostgreSQL connection settings.                      |
| New PostgreSQL devkit | Connects, pools inside the worker, runs queries and transactions, and closes on shutdown.              |
| Bucket table lookup   | Gives function code the table names for a bucket and its child tables, and the bucket's primary key column. |
| Cache preload         | When the cache flag is on, the bootstrap preloads the devkit that matches the engine.                  |

### Flow

1. The scheduler starts a worker with the engine type and connection settings.
2. With the cache flag on, the bootstrap preloads `@spica-devkit/database` on MongoDB, or the new devkit on PostgreSQL.
3. Function code imports the devkit for its engine and runs queries.

## What changes

- **Scheduler:** passes the engine settings to workers.
- **Worker bootstrap:** the preload chooses the devkit by engine.
- **New package:** added to the release workflow's npm publish list.
- **Docs and templates:** show which devkit to use.

## PR breakdown

1. Scheduler passes the engine type and PostgreSQL settings to workers.
2. New devkit package: connect, query, transactions, close.
3. Bucket table lookup.
4. Cache preload by engine.
5. Release workflow entry. This needs a person to set up the npm trusted publisher for the new package.
6. Docs and CLI templates.

## Open questions

- Package name, for example `@spica-devkit/postgresql`.
- Should `spica bucket orm` also generate table name helpers for the new devkit?

## Done when

- A function on a PostgreSQL instance can connect, query and write bucket tables with the new devkit, with and without the cache flag.
- Functions on MongoDB instances behave exactly as today.

## As built

_Fill in after the last PR merges._
