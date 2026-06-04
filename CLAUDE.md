# Spica Backend Engine

## Architecture Overview

Spica is an **open-source backend development engine** built as an Nx monorepo with three main apps and shared libraries. The backend API (`apps/api`) is a NestJS application backed by MongoDB (replica set required). A separate Angular frontend (`apps/spica`) provides the admin UI. A CLI (`apps/cli`) scaffolds and manages Spica instances.

### Project Layout

- **`apps/api/src/`** — NestJS API server. Each domain (bucket, function, passport, storage, dashboard, etc.) is a self-contained sub-project with its own `index.ts`, `project.json`, `jest.config.ts`, and internal `src/`/`test/` dirs.
- **`apps/spica/`** — Angular admin panel (separate build, not covered by backend tests).
- **`apps/cli/`** — `@spica/cli` npm package for project management.
- **`apps/migrate/`** — Database migration runner.
- **`packages/`** — Shared libraries: `core` (pipes, schema, websocket, middleware), `database` (MongoDB wrapper), `filter`, `interface` (TypeScript interfaces per domain), `realtime`, `representative`, `transaction`.
- **`packages/interface/`** — Pure TypeScript interfaces/types organized per domain. No logic—only contracts.

### Key Path Aliases (tsconfig.json)

```
@spica-server/*  → packages/*, apps/api/src/*
@spica-devkit/*  → packages/api/function/packages/*
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

## Release Process

Use `/release <version>` (`.claude/commands/release.md`) to execute a full release. The command walks through every step with a user-approval gate before publishing. Summary of the flow for plain-English requests like "release a new version as x.x.x":

### How versioning works
- Version comes entirely from **git tags** — no package.json files need editing.
- All packages use `0.0.0-PLACEHOLDER` in source; the CI `set-version` target replaces it with `$VERSION` (the tag) in the `dist/` output before publishing.
- Helm chart `charts/spica/Chart.yaml` also uses `0.0.0-PLACEHOLDER`; `scripts/sync_charts.sh` substitutes it at release time.

### What gets published on each release
| Artifact | Where | Tag format |
|---|---|---|
| Docker images | Docker Hub `spicaengine/{api,panel,migrate,mongoreplicationcontroller}` | `<version>` |
| npm packages | npmjs.com `@spica/cli` + `@spica-devkit/{auth,bucket,database,identity,storage}` | `<version>` |
| Helm chart | GCS bucket `gs://spica-charts` / `https://spica-charts.storage.googleapis.com` | `<version>` |

### GitHub Actions workflows involved
- **`.github/workflows/gh_release.yml`** — triggers on `push: tags: ["*"]`. Creates a **draft** GitHub Release with auto-generated notes (diff from previous tag).
- **`.github/workflows/release.yml`** — triggers on `release: types: [published]`. Builds and pushes Docker images, publishes npm packages, syncs Helm chart. Uses `VERSION=$(git describe --tags --abbrev=0)` to resolve the version.

### Release steps (manual summary)
1. `git pull && git fetch --tags` — ensure local is up to date
2. `git tag <version> && git push origin <version>` — triggers `gh_release.yml` (draft release created)
3. Review commits and release notes, then confirm with the user before publishing
4. `gh release edit <version> --repo spica-engine/spica --draft=false` — publishes the release, triggers `release.yml`
5. Monitor `release.yml` run via `gh run view <run_id> --repo spica-engine/spica --json status,conclusion,jobs`
6. Verify artifacts are live: Docker Hub tags, npm versions, Helm chart index
7. If any job fails, inspect with `gh run view <run_id> --repo spica-engine/spica --log-failed`

### GitHub secrets required
- `NPM_TOKEN` — publish token for npmjs.com with `package:write` on all `@spica/*` packages
- `DOCKERHUB_TOKEN` + `DOCKERHUB_USERNAME` (var) — Docker Hub credentials for `spicaengine` org
- `GCP_CREDENTIALS` — GCP service account JSON for Helm chart sync to GCS

## Additional Instructions

@.claude/instructions/performance-optimization.md
@.claude/instructions/atomic-design.md
@.claude/instructions/reactjs.md
