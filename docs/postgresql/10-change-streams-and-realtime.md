# Part 10: Change streams and realtime

## How to use this document

- Plan and implement only this part. Read the code from the parts under "Depends on" on master, along with their "As built" sections. Don't open the other documents in `docs/postgresql/`.
- If this part needs something a merged part doesn't provide, stop and list it under "Requests to other parts" in your plan instead of building it.
- Follow the PR breakdown. Each PR is either a behaviour-neutral refactor or new engine code, never both, and is small enough to review in one sitting.
- Existing MongoDB suites stay green. New code brings its own tests, which run on PostgreSQL in CI. Shared behaviour uses contract suites.
- After the last PR, fill in "As built".

## Purpose

Makes the change feed work on PostgreSQL. Every committed change reaches every listener:

- users' realtime sockets
- function database triggers
- webhooks
- internal caches
- asset watchers
- coordination between API replicas

## Rules that apply

- No resume or catch-up for now. Spica doesn't use change stream resume today, so this matches current behaviour.
- Realtime filters follow the engine, like REST filters. On PostgreSQL, subscribers send SQL filters. The MongoDB in-memory matcher stays for MongoDB.
- Feed events carry documents in today's shape.

## Depends on

- **Part 0 (merged):** the change feed contract and its MongoDB source. All consumers already subscribe to it.
- **Part 5 (merged):** bucket tables and their DDL plan, where triggers attach.
- **Part 6 (merged):** the result shaper.
- **Part 7 (merged):** SQL rendering for realtime ACL.
- **Part 8 (merged):** the SQL filter parser and the query path for initial results.

## Provides

| Contract                 | What later parts expect                                                         |
| ------------------------ | ------------------------------------------------------------------------------- |
| PostgreSQL change source | The change feed fully working on PostgreSQL for bucket and system tables.       |

## Not this part

- Functions writing through the new devkit (Part 11). Their writes are captured automatically, because the triggers live in the database.

## Today

- After Part 0, these consumers subscribe to the change feed, which MongoDB change streams back:
  - realtime gateways
  - the function database enqueuer, webhooks and the function asset watcher
  - the bucket, config, env var, secret and preference caches
  - the asset service
  - replication pub/sub
- Realtime sends an initial result, then applies the subscriber's Mongo filter, sort and limit in memory to each change.

## Target architecture

### Components

| Component             | Responsibility                                                                                              |
| --------------------- | ----------------------------------------------------------------------------------------------------------- |
| Row triggers          | On bucket tables, added by the schema manager's DDL plan. On system tables that have consumers, created together with the table at API startup, and added by a migration on installs that already have the table. They notify on commit. |
| NOTIFY payload        | Only the table, operation and primary key, because notifications have a size limit. The key is the table's own: `id` or the bucket's chosen key. |
| Listener              | A dedicated connection with LISTEN, outside the request pool. It loads the changed row by key and publishes the shaped document on the feed. A deleted row sends its key. |
| Realtime SQL filter   | The first result comes from an SQL query through the query path. Each change is checked against the same filter, and ACL, in PostgreSQL before it goes to the socket. |
| Trigger options       | Function database trigger options map their bucket or collection to tables, with the same operation types.  |

### Flow

1. A write commits, through the API or directly through the devkit.
2. The row trigger sends a notification.
3. The listener loads the row and publishes the event on the change feed.
4. Each consumer reacts:
   - realtime checks the subscriber's filter and ACL, then pushes to the socket
   - triggers enqueue a function event
   - caches refresh
   - replication delivers commands

## What changes

- **Schema manager:** adds triggers to bucket tables.
- **System table creation:** creates the triggers of system tables that have consumers, with the table. A migration adds them on existing installs.
- **Change feed:** a new PostgreSQL source.
- **Realtime:** a PostgreSQL filter path.
- **Function database trigger:** option mapping.

## PR breakdown

1. Listener and the PostgreSQL change source, with triggers on bucket tables. Before the source is written, review `ChangeEvent` (`packages/interface/data/src/change-feed.ts`). It carries MongoDB change stream fields: `_id._data`, `operationType`, `ns`, `documentKey`, `updateDescription` and `fullDocumentBeforeChange`. Move the contract to fields both engines can fill, and have the MongoDB source map to them. Consumers that read the old fields move at the same time.
2. Triggers on system tables that have consumers. Caches and replication work on PostgreSQL.
3. Function database triggers on PostgreSQL.
4. Webhooks, the asset watcher and the asset service on PostgreSQL.
5. Realtime with SQL filters, sort, limit and ACL.

## Open questions

- **Per-change filter checks on busy tables:** check against PostgreSQL for every change and subscriber, or batch them?
- **Neutral event shape:** which `ChangeEvent` fields can PostgreSQL fill? The replica dedupe key `_id._data` and `updateDescription` have no direct equivalent, since the notification carries only the table, operation and key.
- **Listener reconnect:** how does the listener reconnect, and what do subscribers see during the gap?

## Done when

- Every change feed consumer works on PostgreSQL.
- Realtime subscribers with filters, sort and limit see the same results on both engines, each in its own filter language.
- Function database triggers fire on PostgreSQL inserts, updates and deletes.
- PostgreSQL is no longer marked experimental once this part merges, unless review decides otherwise.

## As built

_Fill in after the last PR merges._
