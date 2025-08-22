# Spica Development Engine - AI Agent Instructions

## Project Overview

Spica is a full-fledged, open-source backend development platform with modular architecture. This is an **Nx monorepo** with multiple apps, libraries, and Docker-based deployment.

### Core Architecture

- **API Server** (`apps/api`): NestJS-based microservices aggregated into modules (bucket, function, storage, passport, etc.)
- **CLI** (`apps/cli`): Command-line tool for project management
- **DevKit Libraries** (`apps/api/src/function/packages/`): NPM packages for cloud functions (@spica-devkit/\*)
- **Core Libraries** (`libs/`): Shared TypeScript libraries for internal use

## Development Workflow

### Essential API Commands

```bash
# Start local MongoDB (required for development)
./scripts/start_database.sh

# API development server (most common workflow)
yarn serve:api  # or yarn nx serve api
yarn serve:watch:api  # Hot-reload development

# Build and test API modules
yarn build:api
yarn test:api
yarn test:local:api  # Local testing configuration

# Test specific API modules
yarn nx test api/bucket
yarn nx test api/function
yarn nx test api/passport

# DevKit package development
yarn build:devkit:bucket
yarn test:devkit:database
yarn nx build api/function/packages/bucket

# CLI development (secondary)
./scripts/cli_build_and_link.sh
```

### Nx Workspace Patterns

- Use `yarn nx [command] [project]` for targeted operations
- Project configurations in `project.json` files throughout the workspace
- Custom targets: `compile`, `build-image`, `test-image`, `publish` for different build phases
- Dependencies managed via `dependsOn` in project configurations

### API Development (Primary Focus)

#### API Module Architecture (apps/api/src/\*)

- **Core Modules**: bucket/, function/, passport/, storage/, activity/, dashboard/
- **Module Structure**: Each has controller, service, module files plus subdirectories for features
- **Example Pattern** (bucket module):
  - `bucket.controller.ts` - REST endpoints
  - `bucket-data.controller.ts` - Data manipulation endpoints
  - `bucket.module.ts` - NestJS module configuration
  - `services/` - Business logic implementation
  - `schemas/` - JSON validation schemas
  - `realtime/`, `cache/`, `hooks/` - Feature-specific subdirectories

#### Shared Libraries (libs/) - Critical Dependencies

- **libs/database**: MongoDB service, collection utilities, database pipes
  - Exports: `DatabaseService`, `DatabaseModule`, MongoDB types
  - Used by: All API modules for data persistence
- **libs/core**: Common middlewares, pipes, utilities
  - `middlewares.ts` - CORS, body parsing, headers
  - `pipes.ts` - Validation and transformation pipes
- **libs/realtime**: WebSocket management for real-time features
- **libs/filter**: Query filtering and aggregation utilities
- **libs/interface**: TypeScript interfaces shared across modules

#### API Development Patterns

- **Controllers**: Handle HTTP requests, delegate to services
- **Services**: Contain business logic, interact with database
- **Modules**: Configure NestJS modules with providers, imports, exports
- **Validation**: Use JSON schemas in `schemas/` directories
- **Real-time**: Most modules support WebSocket via `*-realtime` subdirectories

#### DevKit Packages (apps/api/src/function/packages/\*)

- **Purpose**: NPM packages for cloud functions (@spica-devkit/bucket, database, etc.)
- **Build**: Rollup configuration for dual ESM/CJS output
- **Testing**: MongoDB Memory Server for isolated environments

### Database & Realtime Patterns

- **MongoDB**: Primary database with replica set configuration required
- **Real-time**: WebSocket-based real-time updates for most modules (configurable via `*-realtime` flags)
- **Connection Pooling**: Configurable pool sizes for database connections
- **Migration**: Dedicated migration app (`apps/migrate`) for schema/data migrations

### Configuration Management

The API accepts extensive command-line arguments for configuration (see `apps/api/src/main.ts`):

- Database settings (`--database-uri`, `--database-name`, etc.)
- Feature toggles (`--bucket-cache`, `--activity-stream`, etc.)
- Module-specific options (`--function-timeout`, `--storage-strategy`, etc.)
- Environment variables automatically mapped to CLI args

### Testing Strategy

- **Unit Tests**: Jest with module-specific configurations
- **Integration Tests**: Full module tests with real database connections
- **Image Tests**: Docker-based testing (`test-image:*` targets)
- **Local Testing**: `test:local:*` configuration for development
- **Memory Server**: MongoDB Memory Server for isolated database tests

### Deployment & Container Patterns

- **Multi-stage Dockerfiles**: Separate build and runtime stages
- **Kubernetes**: Production deployment via StatefulSets and Services
- **Image Building**: `build-image:*` targets for Docker image creation
- **Publishing**: `publish:*` targets for image/package publishing
- **Replication Controller**: Custom MongoDB replica set initialization

### Code Organization Anti-Patterns to Avoid

- Don't import across app boundaries directly (use libs/ for shared code)
- Don't bypass the DevKit packages when writing functions
- Don't mix business logic in controllers (use services)
- Don't create circular dependencies between modules
- Don't hardcode configuration values (use command-line args/env vars)

### Key Files for Understanding

- `apps/api/src/main.ts`: Application bootstrap with all configuration options
- `apps/api/project.json`: Build and deployment configurations
- `libs/database/src/database.service.ts`: Core database service used by all modules
- `libs/core/src/middlewares.ts`: Common HTTP middlewares (CORS, body parsing)
- `apps/api/src/bucket/src/bucket.module.ts`: Example of typical API module structure
- `nx.json`: Workspace-wide build and test configurations
- Individual `project.json` files: Module-specific build configurations

### API-Specific Debugging & Development Tips

- Use `yarn nx serve:watch api` for hot-reload development
- MongoDB replica set must be running locally for most operations
- Function debugging requires `--function-debug=true` flag
- Access logs available with `--access-logs=true`
- Use `yarn nx test api/[module] -c local` for interactive testing
- Check `libs/database` exports when working with MongoDB collections
- Most API modules follow the pattern: controller → service → database
- Real-time features can be toggled with `--[module]-realtime=false` flags

## Other Project Components

### CLI (`apps/cli`)

- **Purpose**: Command-line interface for Spica project management
- **Build**: `yarn nx build cli` or `./scripts/cli_build_and_link.sh` for development
- **Global Install**: Links CLI globally for testing with `spica` command
- **Dependencies**: Uses interface libraries for type definitions
- **Structure**: TypeScript project with binary wrapper scripts

### Migration Tool (`apps/migrate`)

- **Purpose**: Database schema and data migration utility
- **Usage**: Handles upgrades between Spica versions
- **Build**: `yarn nx compile migrate` (includes path resolution)
- **Testing**: `yarn nx test migrate` with acceptance tests
- **Docker**: Available as `spicaengine/migrate` container image

### MongoDB Replication Controller (`apps/mongoreplicationcontroller`)

- **Purpose**: Kubernetes job for initializing MongoDB replica sets
- **Usage**: One-time setup for MongoDB clustering in K8s environments
- **Build**: `yarn nx build mongoreplicationcontroller`
- **Deploy**: Runs as Kubernetes Job during cluster initialization
- **Configuration**: Uses command-line args for MongoDB connection details

### Helm Charts (`charts/spica/`)

- **Purpose**: Kubernetes deployment configurations via Helm
- **Structure**:
  - `Chart.yaml` - Chart metadata and versioning
  - `values.yaml` - Default configuration values
  - `templates/` - Kubernetes resource templates
- **Publishing**: `yarn publish:charts` syncs with chart repository
- **Usage**: Production deployment of complete Spica stack
