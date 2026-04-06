# Spica Backend Engine — Copilot Instructions

## Architecture Overview

Spica is an **open-source backend development engine** built as an Nx monorepo with three main apps and shared libraries. The backend API (`apps/api`) is a NestJS application backed by MongoDB (replica set required). A separate Angular frontend (`apps/spica`) provides the admin UI. A CLI (`apps/cli`) scaffolds and manages Spica instances.

### Project Layout

- **`apps/api/src/`** — NestJS API server. Each domain (bucket, function, passport, storage, dashboard, etc.) is a self-contained sub-project with its own `index.ts`, `project.json`, `jest.config.ts`, and internal `src/`/`test/` dirs.
- **`apps/spica/`** — Angular admin panel (separate build, not covered by backend tests).
- **`apps/cli/`** — `@spica/cli` npm package for project management.
- **`apps/migrate/`** — Database migration runner.
- **`libs/`** — Shared libraries: `core` (pipes, schema, websocket, middleware), `database` (MongoDB wrapper), `filter`, `interface` (TypeScript interfaces per domain), `realtime`, `representative`, `transaction`.
- **`libs/interface/`** — Pure TypeScript interfaces/types organized per domain. No logic—only contracts.

### Key Path Aliases (tsconfig.json)

```
@spica-server/*  → libs/*, apps/api/src/*
@spica-devkit/*  → apps/api/src/function/packages/*
@spica/*         → apps/*
```

Import from `@spica-server/bucket`, `@spica-server/database`, `@spica-server/core`, etc.—never use relative paths across module boundaries.

## Module System & Patterns

Every API domain module follows the **NestJS `DynamicModule` with `.forRoot()` pattern**. The root module in `apps/api/src/main.ts` composes all domain modules with CLI args passed as options. Feature flags (e.g., `bucket-hooks`, `bucket-history`, `activity-stream`) conditionally include sub-modules.

### Controller conventions

- All controllers use `@UseGuards(AuthGuard(["IDENTITY", "APIKEY"]), ActionGuard("domain:action"))` for auth + policy enforcement.
- Use `@ResourceFilter()` param decorator to receive policy-based resource filters.
- Query params use custom pipes from `@spica-server/core`: `NUMBER`, `BOOLEAN`, `DEFAULT(value)`, `JSONP`, `ARRAY(coerce)` — not NestJS built-in pipes.
- Activity logging via `@UseInterceptors(activity(...))` with domain-specific `createXxxActivity` helpers.

### Database access

- `DatabaseModule.withConnection(uri, opts)` provides a global `DatabaseService` (MongoDB `Db` instance).
- Domain services inject `DatabaseService` and call `this.db.collection("name")` directly—no ORM.
- Always use `ObjectId` from `@spica-server/database`, not from `mongodb` directly.

### Testing modules

Each domain exposes a `*TestingModule` under a `testing/` directory:

- `DatabaseTestingModule.replicaSet()` — spins up `mongodb-memory-server` with replica set.
- `CoreTestingModule` — provides `Request` helper for HTTP testing.
- `PassportTestingModule.initialize()` — stubs auth guards.
- `PreferenceTestingModule` — in-memory preference store.

Tests use `@nestjs/testing` `Test.createTestingModule(...)` and listen on a dynamic socket.

### Synchronizer / Version Control pattern

Modules that support version control export `getSupplier` and `getApplier` from a `synchronizer/schema/` directory, and register via `REGISTER_VC_CHANGE_HANDLER` injection token. Asset support uses `registerAssetHandlers` with `IRepresentativeManager`.

## Build & Development Commands

```bash
yarn install                      # install all deps (workspaces)
yarn build:api                    # compile API (nx compile api)
yarn serve:api                    # run API via @nx/js:node
yarn serve:watch:api              # run API with nodemon (hot reload)
yarn test:api                     # run all API + lib tests
yarn nx test <project>            # run tests for a specific project (e.g., yarn nx test bucket)
yarn nx run-many -t test -c local # run tests with visible output (non-silent)
```

Tests require pre-built artifacts: function runtime bootstrap, typescript compiler worker. `jest.setup.js` sets `FUNCTION_SPAWN_ENTRYPOINT_PATH` and `FUNCTION_TS_COMPILER_PATH` pointing into `dist/`. Run `yarn build:api` before running tests if those paths are missing.

Jest timeout is 30 seconds globally. The `ci-cd` configuration runs with `--forceExit --runInBand --silent`.

## Docker & Deployment

- Dockerfile: multi-stage (`deps` → `build` → `test` → `runner`). Runner uses `node:22-slim`, entrypoint is `node ./dist/apps/api/src/main.js`.
- Images: `spicaengine/api`, `spicaengine/panel` (frontend).
- Kubernetes: deployed as a `StatefulSet` with MongoDB sidecar (see `deployment.yaml`, `charts/spica/`).
- MongoDB must run as a **replica set** (`--replSet rs0`); change streams require it.

## Configuration

The API uses `yargs` for CLI arg parsing with `.env()` support. Secrets can come from env vars: `PASSPORT_SECRET`, `MONGODB_USERNAME`, `MONGODB_PASSWORD`, `BUCKET_DATA_HASH_SECRET`, `BUCKET_DATA_ENCRYPTION_SECRET`, `TWILIO_*`, `USER_*`. Required args: `--database-uri`, `--database-name`, `--passport-secret`, `--public-url`.
