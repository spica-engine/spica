# Part 1: Provisioning, connection and test setup

## How to use this document

- Plan and implement only this part. Read the code from the parts under "Depends on" on master, along with their "As built" sections. Don't open the other documents in `docs/postgresql/`.
- If this part needs something a merged part doesn't provide, stop and list it under "Requests to other parts" in your plan instead of building it.
- Follow the PR breakdown. Each PR is either a behaviour-neutral refactor or new engine code, never both, and is small enough to review in one sitting.
- Existing MongoDB suites stay green. New code brings its own tests.
- After the last PR, fill in "As built".

## Purpose

Starts the chosen engine next to the API, gives the API its connection settings, opens one shared connection at boot, and gives tests and CI a throwaway PostgreSQL. The engine is picked at install time and stays fixed for the life of the instance.

## Rules that apply

- One engine per instance, chosen at install time. MongoDB stays the default, so existing installs need no change.
- PostgreSQL stays experimental. The API logs a warning when it starts with `--database-type postgresql`.
- PostgreSQL 18 is the minimum version, because system tables rely on its built-in `uuidv7()`. The API refuses to start on an older server, and the chart, CLI and test images use 18.
- Testing rule for all later parts: new PostgreSQL code adds tests that run in the PostgreSQL CI job. Shared behaviour gets contract cases that run on both engines.

## Depends on

- **Part 0 (merged):** the adapter registration point. Use it to bind the PostgreSQL connection.

## Provides

| Contract                     | What later parts expect                                                                                     |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `--database-type`            | `mongodb` (default) or `postgresql`, readable by any module.                                                |
| PostgreSQL connection        | A shared PostgreSQL driver with a bounded pool, available to adapters through the registration point.      |
| Engine in status             | The status endpoint reports the running engine.                                                             |
| Testing module engine option | `DatabaseTestingModule` starts MongoDB or a throwaway PostgreSQL.                                           |
| PostgreSQL CI job            | Runs only the suites marked as ready for PostgreSQL, plus contract tests.                                   |
| Contract test harness        | A way to write one test case and run it against both adapters.                                              |

## Not this part

- Creating any tables. Part 2 adds the migration track and Part 3 adds the system tables.
- Passing engine settings to function workers. Part 11 does that.
- pg_cron. Part 4 enables it.

## Today

- **Helm chart (`charts/spica`):** renders a MongoDB StatefulSet with a replication controller, secrets, a service, an init job and a migrate job.
- **CLI `project start`:** starts a MongoDB replica set and the API as Docker containers. `project ls` and `project remove` manage them.
- **`apps/api/src/main.ts`:**
  - Requires `--database-uri` and `--database-name`.
  - Takes optional `--database-replica-set`, `--database-pool-size`, `--database-read-preference` and `--database-change-stream-await-time`.
  - Can read credentials from `MONGODB_USERNAME` and `MONGODB_PASSWORD`.
- **`DatabaseModule.withConnection`:** opens the MongoDB client and provides a global `DatabaseService`.
- **Tests:** `DatabaseTestingModule.replicaSet()` starts `mongodb-memory-server`. MongoDB suites are reliable only with `--runInBand`.

## Target architecture

### Components

| Component               | Responsibility                                                                                              |
| ----------------------- | ----------------------------------------------------------------------------------------------------------- |
| Engine argument         | `--database-type` picks the engine. Mongo-only arguments are ignored on PostgreSQL. PostgreSQL counterparts are added only where needed. |
| Connection module       | Reads the engine and opens either today's MongoDB connection or the PostgreSQL driver.                     |
| PostgreSQL driver       | Keeps a small set of open connections and reuses them across requests, sized by `--database-pool-size`. Spica only configures the size. |
| PostgreSQL credentials  | Come from environment variables, like the MongoDB ones.                                                     |
| Chart engine switch     | A chart value renders either the MongoDB templates or new PostgreSQL templates. The database is only reachable inside the cluster, like MongoDB. |
| CLI engine flag         | `project start` starts a MongoDB or a PostgreSQL container. `project ls` and `project remove` handle both.  |
| Testing module          | Takes an engine option and starts a throwaway PostgreSQL per suite.                                         |
| CI job                  | Runs the PostgreSQL-ready suites and the contract tests. Suites opt in as later parts make them work.      |

### Flow

1. The operator installs the chart with the engine value, or a developer runs `project start` with the engine flag.
2. Only the chosen engine starts.
3. The API starts with `--database-type` and its connection arguments.
4. The connection module opens the engine and binds it through the adapter registration point.
5. The status endpoint reports the engine.

## What changes

- **`main.ts`:** gets the new argument and logs the experimental warning.
- **Connection module:** grows a PostgreSQL branch.
- **Status module:** reports the engine.
- **Chart:** the MongoDB templates become conditional, and PostgreSQL templates are added.
- **CLI:** `project` commands handle both engines.
- **Test setup:** `DatabaseTestingModule` gets the engine option, there's a contract test harness, and CI gets the PostgreSQL job.

## PR breakdown

1. `--database-type`, the connection module branch, the minimum version check, the experimental warning, and the engine in status.
2. Testing module engine option and the PostgreSQL CI job, with only a connection smoke test enabled.
3. Contract test harness, with one example case.
4. Helm chart PostgreSQL templates and the engine switch.
5. CLI `project start`, `ls` and `remove` engine support.

## Open questions

- Throwaway PostgreSQL in tests: a container or an embedded server?

## Done when

- The API starts on either engine and reports which one.
- A fresh chart install and a fresh `project start` work with either engine.
- Existing MongoDB installs upgrade with no change to their values or arguments.
- The PostgreSQL CI job runs and passes.

## As built

### Contracts

| Contract                     | As built                                                                                                                                                                  |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--database-type`            | `mongodb` (default) or `postgresql`, a yargs option in `apps/api/src/main.ts`. `--database-name` is required only for MongoDB.      |
| PostgreSQL connection        | `@spica-server/data-postgresql` (`packages/data/postgresql`). `PostgresDataAdapter.forRoot(uri, {poolSize})` takes a string or a lazy `() => Promise<string>`. It provides a global `pg.Pool` under the `PG_POOL` token (`@spica-server/interface-data`), sized by `--database-pool-size`. Idle client errors are logged, not thrown, and the pool ends on shutdown. |
| Credentials                  | `POSTGRES_USERNAME` and `POSTGRES_PASSWORD` are injected into the uri, like the MongoDB ones.                                                                             |
| Version check                | Boot fails unless `server_version_num` is at least 180000. A missing `pg_cron` only logs a warning.                                                                       |
| Engine in status             | Not reported. `/status/ready` is public, so it still answers `{status: "ok"}`. The engine name is available as `DATA_ENGINE`.                                              |
| Testing module engine option | `DatabaseTestingModule.postgres(dbName?)`. One `postgres:18` Testcontainers container per process, or `POSTGRES_URL`, with a new database per module. The adapter is registered in the root `jest.setup.js` under `SPICA_TESTING_POSTGRES_ADAPTER`. |
| PostgreSQL CI job            | `test_affected` starts only the services each affected project needs. `scripts/ci-test-matrix.mjs` reads the project's specs: `database-testing` or `MONGODB_URL` means MongoDB, `contractSuite` or `POSTGRES_URL` means PostgreSQL, `RABBITMQ_*` means RabbitMQ, `MAILER_URL` means mailhog. A service URL is exported only when the service was started, so a spec the script missed starts its own container. Contract suites run on both engines in every affected project. `yarn check:engine-specs` (flags `--strict` and `--under=<path>`; self-test `yarn test:engine-specs`) lists specs that still use the MongoDB-only testing module without `contractSuite` or `mongoOnly`. |
| Contract test harness        | `contractSuite(name, engine => {...})` in `@spica-server/database-testing`. MongoDB always runs. PostgreSQL runs when `POSTGRES_URL` or `SPICA_CONTRACT_ENGINES` enables it. With `CI=true` a disabled engine fails the suite instead of skipping. `mongoOnly(reason)` marks a spec that can not run on PostgreSQL. |

### Chart and CLI

- Chart: `database.type` (`mongodb` default, `postgresql`). A missing `database.type` counts as `mongodb`, so a release upgraded with `--reuse-values` from before this key existed keeps its MongoDB resources, and any other value fails the render. The MongoDB templates and the migrate job render only for MongoDB, and the default render is byte-identical to before. PostgreSQL adds `postgres.yaml`, `postgressrv.yaml`, `postgressecrets.yaml` and `postgresinitdb.yaml`, driven by the existing `database` values (`version`, `name`, the `spica*` and `root*` credentials, storage, resources, probes and scheduling). `database.version` defaults to 8.0.4 for MongoDB and 18 for PostgreSQL.
- Chart users: like MongoDB, there is a root user and an unprivileged `spica` user. `root` is the PostgreSQL superuser. `spica` is a plain login role that owns the `database.name` database, has no other privileges, and is the only one the API uses. An init script in `/docker-entrypoint-initdb.d` creates it on first start, so changing the credentials later needs `ALTER ROLE` by hand. Both secrets keep the MongoDB names, `<release>-database-spica-credentials` and `<release>-database-root-credentials`.
- Chart replicas: the PostgreSQL StatefulSet is hardcoded to one replica and ignores `database.replicas`. Replication will need custom scripts or an operator. The database is not reachable from outside the cluster and the chart has no external-server or SSL option.
- CLI: `project start --database-type` and `--postgres-version`. `project ls` recognises `postgres` containers. `project remove` is label-based and needed no change.

### Answers to the open questions

- Throwaway PostgreSQL in tests: a container (Testcontainers), with a `POSTGRES_URL` override for CI.
- `pg_cron`: optional. The API only warns when the server does not offer it.
- External PostgreSQL server: dropped from the chart, to match MongoDB.

### Differs from the plan

- `DataModule` needs `ID_TYPES` to boot, so the adapter binds a placeholder `PostgresIdTypes` that throws on use. Part 3 replaces it. No other contract token is bound yet.
- The engine is not in the status response (see above). Reporting it on the authenticated `GET /status` is open.
- The CI workflow only triggers on pull requests to `master`, so the `test_affected` jobs are not exercised on the stacked branches.
- `project upgrade` and the chart migrate job still assume MongoDB. Part 2 owns PostgreSQL migrations.
- `FunctionModule.forRoot` still takes the MongoDB uri, name and replica set. Part 11 owns worker engine settings.
