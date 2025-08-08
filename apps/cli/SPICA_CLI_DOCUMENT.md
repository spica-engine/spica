# Spica CLI (MCP-Ready Documentation)

Purpose: A clean, concise reference for the `spica` CLI. Optimized for MCP servers and vector search.

## Overview

- Binary: `spica`
- Scope: Contexts, local projects (Docker), asset operations, ORM generators
- Auth: Uses API Key via contexts

## Prerequisites

- Docker installed and running (for project commands)
- A Spica API URL and API Key (for context and remote operations)

## Installation & Setup

The CLI is distributed as `@spica/cli` npm package with binary name `spica`.

```bash
npm install -g @spica/cli
spica --help
```

## Core Concepts

### Context Management

Contexts store connection information (URL and API key) for Spica instances. The CLI uses these contexts to authenticate and connect to different Spica environments.

### Project Operations

Projects are local Spica instances running in Docker containers. The CLI manages the complete lifecycle of these local instances.

### Asset Management

Assets are collections of Spica resources (buckets, functions, preferences) packaged together for deployment.

### ORM Generation

Object-Relational Mapping features generate TypeScript interfaces and methods for type-safe interaction with Spica resources.

## Quick Start

1. Create/select a context

- `spica context set --name <name> --url <url/api> --apikey <key>`
- `spica context switch <name>`

2. Use commands (e.g., `spica project start <name>`)

## Context Commands

### context set

Create or update a context.

- Usage: `spica context set --name <name> --url <url/api> --apikey <apikey>`
- Notes: Name is recommended; URL and API Key are required.

**Example:**

```bash
spica context set --name production --url  https:/test.spica.com/api --apikey YOUR_API_KEY
```

### context ls

List configured contexts and show selected one.

- Usage: `spica context ls`

### context switch

Select an existing context.

- Usage: `spica context switch <name>`

### context remove

Delete a context.

- Usage: `spica context remove <name>`

## Project Commands (Local Docker)

### project start

Start a local Spica instance.

- Usage: `spica project start <name> [options]`
- Options:
  - `--port <number>` default: 4500
  - `--image-version <tag>` default: latest
  - `--open` open browser after creation
  - `--force` remove existing with same name
  - `--retain-volumes` default: true (when false, data is removed)
  - `--restart` default: true (auto-restart containers)
  - `--image-pull-policy <if-not-present|default>` default: if-not-present
  - `--database-replicas <number>` default: 1
  - `--api-options <absolute_path>` JSON file with API options
  - `--local-resource-folder <absolute_path>` two-way sync folder (caution: initial sync may overwrite local managed files)
- Output: Spica served at http://localhost:<port>
- Default login (unless overridden by api-options): identifier `spica`, password `spica`.

**Example:**

```bash
spica project start myproject --port 3000 --open
```

### project ls

List local projects.

- Usage: `spica project ls`

### project remove

Stop and remove a local project.

- Usage: `spica project remove <name> [--retain-volumes]`
- Option: `--retain-volumes` default: true (when false, volumes are deleted)

### project upgrade

Upgrade an existing local project to a target version.

- Usage: `spica project upgrade <name> <version> [--restart]`
- Notes: Pulls new images, recreates containers, runs migration.

### project sync

Synchronize resources between two instances.

- Usage:
  - `spica project sync --source-url <url/api> --source-apikey <key> --target-url <url/api> --target-apikey <key> --modules <list> [id filters] [flags]`
- Modules (comma-separated): `bucket,function,bucket-data,apikey,policy,env-var`
- Optional ID filters (comma-separated):
  - `--bucket-ids <ids>`
  - `--function-ids <ids>`
  - `--apikey-ids <ids>`
  - `--policy-ids <ids>`
  - `--env-var-ids <ids>`
- Flags:
  - `--dry-run` show planned inserts/updates/deletes
  - `--ignore-errors` continue on request errors
  - `--concurrency-limit <number>` default: 100
- Version requirement: both instances v0.9.19+ (ideally same version).

**Example:**

```bash
spica project sync \
  --source-url https://source.spica.com/api \
  --source-apikey SOURCE_KEY \
  --target-url https://target.spica.com/api \
  --target-apikey TARGET_KEY \
  --modules bucket,function \
  --dry-run
```

## Asset Commands

### asset apply

Upload an asset (composed resources) to the current context instance.

- Usage: `spica asset apply [--path <folder>] [--dry-run]`
- Requirements in folder: `asset.yaml` plus resource files under module folders (e.g., bucket/, function/)

**Example:**

```bash
spica asset apply --path ./my-asset
```

### asset delete

Delete an existing asset by name from `asset.yaml` in the folder.

- Usage: `spica asset delete --type <soft|hard> [--path <folder>]`

**Example:**

```bash
spica asset delete --type soft --path ./my-asset
```

## ORM Generators

All ORM commands use the currently selected context to discover schemas/functions.

### bucket orm

Generate a typed ORM for buckets.

- Usage: `spica bucket orm [--path <folder>]`
- Output: `bucket.ts` in the target folder
- Features: typed interfaces, CRUD helpers, relations, localization, pagination, realtime helpers

**Example:**

```bash
spica bucket orm --path ./src/generated
```

### function orm

Generate typed clients for functions.

- Usage: `spica function orm [--path <folder>] [--trigger-types <types>] [--http-service <axios>]`
- Defaults: `--path ./functions`, `--trigger-types http`, `--http-service axios`
- Output: one folder per function with typed client code

**Example:**

```bash
spica function orm --path ./src/functions --http-service axios
```

## Notes & Tips

- Most commands require a selected context (except local project lifecycle operations).
- Use `--dry-run` for safe previews (sync, asset apply).
- For project start with `--local-resource-folder`, initial sync can overwrite managed files under that folder; un-managed files (e.g., .git) remain.
- If requests fail during sync, adjust `--concurrency-limit` or enable `--ignore-errors`.

## Error Recovery

- Use `--ignore-errors` flag in sync operations to continue despite failures
- Check connection and authentication with `spica context ls`
- Verify Docker status for project operations
- Use `--dry-run` to preview changes before applying

## Best Practices

### Context Management

- Use descriptive names for contexts (e.g., "production", "staging", "local")
- Regularly verify context connectivity
- Secure API keys appropriately

### Project Development

- Use version control for generated ORM files
- Test asset deployments with `--dry-run` first
- Keep local projects updated with `project upgrade`
- Use resource folders for organized asset management

### Synchronization

- Always test sync operations with `--dry-run` first
- Use specific resource IDs to sync subsets of data
- Monitor sync operations for errors
- Backup target instances before major sync operations

### ORM Usage

- Regenerate ORM files when bucket schemas change
- Use TypeScript strict mode for better type safety
- Leverage relation resolution for complex data structures
- Implement proper error handling in generated code

## Troubleshooting

### Docker Issues

- Ensure Docker daemon is running
- Check Docker permissions
- Verify available ports
- Monitor container logs

### Network Issues

- Verify API endpoint URLs
- Check firewall settings
- Test connectivity with curl or similar tools
- Validate SSL certificates

### Authentication Issues

- Verify API key permissions
- Check token expiration
- Ensure correct context selection
- Test authentication with simple API calls
