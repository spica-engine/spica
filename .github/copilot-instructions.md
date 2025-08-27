# Spica Development Engine - GitHub Copilot Instructions

## Repository Overview

Spica is a full-fledged, free and open-source backend development platform built with TypeScript and NestJS. It provides enterprise-grade backend features including data modeling, real-time database, cloud functions, identity and access management, storage (CDN), and dashboards. The platform can be used both as a backend engine and as a headless CMS.

**Key Facts:**
- **Size:** Large monorepo (~200+ NX projects) with ~3,000+ TypeScript files
- **Architecture:** NX workspace with multiple apps and shared libraries
- **Languages:** TypeScript (primary), JavaScript, JSON configuration files
- **Frameworks:** NestJS, Angular (frontend), MongoDB, Docker
- **Runtime:** Node.js 22.x
- **Package Manager:** Yarn with workspaces
- **Build System:** NX with TypeScript compiler and custom project configurations

## Essential Environment Setup

**Required Dependencies:**
- Node.js 22.x (as specified in package.json and GitHub Actions)
- Yarn package manager
- Docker (for MongoDB and containerized testing)
- MongoDB 7.0+ (via Docker or local installation)

**Critical Environment Variables:**
- `NX_NO_CLOUD=true` - **ALWAYS set this** to avoid NX Cloud connection issues
- `NODE_OPTIONS=--experimental-vm-modules` - Set for testing (from .test.env)

**Initial Setup (MUST be done in this order):**
```bash
# 1. Install dependencies (can take 2-3 minutes)
yarn install --frozen-lockfile

# 2. Set essential environment variables
export NX_NO_CLOUD=true
export NODE_OPTIONS=--experimental-vm-modules

# 3. Clean any existing database files
./scripts/clean_database.sh
```

## Build Instructions

**Core Build Commands (validated and working):**

### Building Projects
```bash
# Always set NX_NO_CLOUD before any NX command
export NX_NO_CLOUD=true

# Build CLI (fast, ~5 seconds)
yarn build:cli

# Build all DevKit packages (for cloud functions)
yarn build:devkit:*

# Build specific DevKit packages
yarn build:devkit:bucket
yarn build:devkit:database
yarn build:devkit:identity
yarn build:devkit:storage

# Build API server (requires dependencies)
yarn build:api

# Build migration tool
yarn build:migrate

# Build MongoDB replication controller
yarn build:mongoreplicationcontroller
```

### Docker Image Building
```bash
# Build API Docker image
yarn build-image:api

# Build migration Docker image
yarn build-image:migrate

# Build MongoDB controller Docker image
yarn build-image:mongoreplicationcontroller
```

**Build Output:** All builds output to `dist/` directory with preserved project structure.

## Testing Instructions

**Working Test Commands:**
```bash
export NX_NO_CLOUD=true

# Test CLI (fast, works reliably)
yarn test:cli

# Test DevKit packages (unit tests only - integration tests need MongoDB)
yarn test:devkit:*

# Test specific DevKit packages
yarn test:devkit:bucket
yarn test:devkit:database
yarn test:devkit:identity
yarn test:devkit:storage
```

**Database-Dependent Tests:**
Integration tests require MongoDB. Use Docker for consistent testing:
```bash
# Start MongoDB for integration tests
./scripts/start_database.sh &

# Integration tests will fail without network access to download MongoDB
# In CI/CD, use docker-based testing instead:
yarn test-image:api
yarn test-image:migrate
```

**Test Failure Notes:**
- Integration tests may fail due to network issues downloading MongoDB binaries
- Tests run with `--forceExit --runInBand --silent` in CI mode
- Some test failures in CLI are known and don't indicate broken functionality

## Code Quality & Formatting

```bash
# Format check (may require git master branch setup)
yarn format:check

# Auto-format code
yarn format
```

## Key Repository Structure

### Applications (`apps/`)
```
apps/
├── api/                    # Main NestJS API server
│   ├── src/               # API modules (bucket, function, passport, etc.)
│   ├── Dockerfile         # API container image
│   └── project.json       # NX project configuration
├── cli/                   # Spica CLI tool (@spica/cli npm package)
├── migrate/               # Database migration tool
├── mongoreplicationcontroller/  # Kubernetes MongoDB controller
└── spica/                 # Angular frontend dashboard
```

### Libraries (`libs/`)
```
libs/
├── core/                  # Core utilities (testing, schema, websocket)
├── database/              # Database utilities and testing tools
├── filter/                # Data filtering utilities
├── interface/             # TypeScript interfaces for all modules
├── realtime/              # Real-time functionality
└── representative/        # Data representation utilities
```

### DevKit Packages (`apps/api/src/function/packages/`)
These are NPM packages for cloud functions:
- `@spica-devkit/bucket` - Bucket/database operations
- `@spica-devkit/database` - Direct database access
- `@spica-devkit/identity` - Identity/authentication
- `@spica-devkit/storage` - File storage operations

### Configuration Files
- `nx.json` - NX workspace configuration
- `tsconfig.json` - TypeScript configuration with path mapping
- `package.json` - Root dependencies and scripts
- `jest.config.ts` - Jest testing configuration
- `.github/workflows/ci.yml` - CI/CD pipeline
- `scripts/` - Utility scripts for database and build operations

## Critical Development Patterns

### NX Project Commands
```bash
# List all projects
yarn nx show projects

# Run command for specific project
yarn nx <command> <project-name>

# Example: build specific API module
yarn nx build api/function
```

### TypeScript Path Mapping
The repository uses extensive path mapping:
```typescript
"@spica-devkit/*": ["apps/api/src/function/packages/*"]
"@spica-server/*": ["libs/*", "apps/api/src/*"]
"@spica/*": ["apps/*"]
```

### Docker Development
```bash
# Build and test in Docker (preferred for CI consistency)
docker build --target test -f ./apps/api/Dockerfile .
docker build -f ./apps/api/Dockerfile .
```

## CI/CD Pipeline

The repository uses GitHub Actions with a matrix strategy testing multiple components:

**Key CI Commands:**
- `format:check` - Code formatting validation
- `build:*` commands - Building various components
- `test:*` commands - Testing suites
- `test-image:*` commands - Docker-based testing (preferred)

**CI Environment Requirements:**
- Node.js 22.x
- Yarn package manager
- Docker for containerized testing
- MongoDB (via Docker)
- Optional: RabbitMQ (for function enqueuer tests)

## Common Issues & Solutions

### Build Failures
1. **NX Cloud Connection Issues:** Always set `NX_NO_CLOUD=true`
2. **Missing Dependencies:** Run `yarn install --frozen-lockfile`
3. **Path Resolution:** Use `resolve-tspaths` after builds (automatically run)

### Test Failures
1. **MongoDB Download Issues:** Tests may fail offline - use Docker-based testing
2. **Integration Test Setup:** Requires running MongoDB instance
3. **Memory Issues:** Large test suites may need `--maxWorkers=1`

### Database Issues
1. **Clean Database State:** Use `./scripts/clean_database.sh`
2. **Start Fresh MongoDB:** Use `./scripts/start_database.sh`

## Quick Validation Checklist

To verify your development environment:
```bash
# 1. Dependencies installed
yarn install --frozen-lockfile

# 2. Environment set
export NX_NO_CLOUD=true

# 3. Basic build works
yarn build:cli

# 4. Basic tests work
yarn test:cli

# 5. DevKit packages build
yarn build:devkit:bucket
```

## Final Notes

- **Always use yarn, not npm** - The repository is configured for Yarn workspaces
- **Set NX_NO_CLOUD=true** before any NX commands to avoid cloud connection failures
- **Use Docker for integration testing** when possible for consistency
- **Large builds can take 5-10 minutes** - be patient with complex components
- **Database tests need network access** - Docker-based testing is more reliable in CI/CD
- **Focus on unit tests for quick feedback** - integration tests are more complex to set up

This is a complex, enterprise-grade monorepo. Start with small changes and validate frequently with the CLI and DevKit packages before working on the full API server.
