# Spica CLI (MCP-Ready Documentation)

Purpose: A clean, concise reference for the `spica` CLI. Optimized for MCP servers and vector search.

## Overview

- Binary: `spica`
- Scope: Contexts, local projects (Docker), asset operations, ORM generators
- Auth: Uses API Key via contexts

## Prerequisites

- Docker installed and running (for project commands)
- A Spica API URL and API Key (for context and remote operations)

## Quick Start

1. Create/select a context

- `spica context set --name <name> --url <api_url> --apikey <key>`
- `spica context switch <name>`

2. Use commands (e.g., `spica project start <name>`)

## Context Commands

### context set

Create or update a context.

- Usage: `spica context set --name <name> --url <url> --apikey <apikey>`
- Notes: Name is recommended; URL and API Key are required.

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
  - `spica project sync --source-url <url> --source-apikey <key> --target-url <url> --target-apikey <key> --modules <list> [id filters] [flags]`
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

## Asset Commands

### asset apply

Upload an asset (composed resources) to the current context instance.

- Usage: `spica asset apply [--path <folder>] [--dry-run]`
- Requirements in folder: `asset.yaml` plus resource files under module folders (e.g., bucket/, function/)

### asset delete

Delete an existing asset by name from `asset.yaml` in the folder.

- Usage: `spica asset delete --type <soft|hard> [--path <folder>]`

## ORM Generators

All ORM commands use the currently selected context to discover schemas/functions.

### bucket orm

Generate a typed ORM for buckets.

- Usage: `spica bucket orm [--path <folder>]`
- Output: `bucket.ts` in the target folder
- Features: typed interfaces, CRUD helpers, relations, localization, pagination, realtime helpers

### function orm

Generate typed clients for functions.

- Usage: `spica function orm [--path <folder>] [--trigger-types <types>] [--http-service <axios>]`
- Defaults: `--path ./functions`, `--trigger-types http`, `--http-service axios`
- Output: one folder per function with typed client code

## Notes & Tips

- Most commands require a selected context (except local project lifecycle operations).
- Use `--dry-run` for safe previews (sync, asset apply).
- For project start with `--local-resource-folder`, initial sync can overwrite managed files under that folder; un-managed files (e.g., .git) remain.
- If requests fail during sync, adjust `--concurrency-limit` or enable `--ignore-errors`.

## Minimal Examples

- Set context: `spica context set --name prod --url https://api.example.com --apikey XXXX`
- Start local: `spica project start demo --port 4500 --open`
- Sync buckets and functions (dry): `spica project sync --source-url https://src --source-apikey A --target-url https://dst --target-apikey B --modules bucket,function --dry-run`
- Generate bucket ORM: `spica bucket orm --path ./src/generated`
- Apply asset: `spica asset apply --path ./my-asset`
