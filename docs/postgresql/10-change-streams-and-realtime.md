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
- Realtime filters follow the engine, like REST filters. On PostgreSQL, subscribers send expression filters. The MongoDB in-memory matcher stays for MongoDB.
- Feed events carry documents in today's shape.

## Depends on

- **Part 0 (merged):** the change feed contract and its MongoDB source. All consumers already subscribe to it.
- **Part 5 (merged):** bucket tables and their DDL plan, where triggers attach.
- **Part 6 (merged):** the result shaper.
- **Part 7 (merged):** SQL rendering for realtime ACL.
- **Part 8 (merged):** the caller filter compiler (`compileFilter`, `compileFilterIn`, `compileFilterNode`) and the query path for initial results.

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
| Realtime filter       | The first result comes from a query through the query path. Each change is checked against the same filter, and ACL, in PostgreSQL before it goes to the socket. |
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
5. Realtime with expression filters, sort, limit and ACL.

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

### The planned items

The plan had five PRs. Realtime was split further, because it was a refactor and new code, and the work it needed to be fast for many subscribers came out of review.

| PR | What it is |
| --- | --- |
| #2194 | **Neutral `ChangeEvent`** (refactor). `id` (the same on every replica), `operation`, `collection`, `key`, `document`, `previousDocument` and `changes: {updated, removed}` replace the MongoDB change stream fields. `MongoChangeFeed` maps its events to it, and the enqueuer, webhook invoker, function asset watcher and replication feed memory read the new fields. What user functions receive is unchanged. |
| #2195 | **PostgreSQL change source and bucket-table triggers.** See "The change feed". |
| #2196 | **System-table triggers.** The same function and triggers on the tracked system tables, installed at startup. The feed reads their rows through the ORM and fills `previousDocument` from chosen old columns. Replication commands and the function asset watcher work on PostgreSQL. |
| #2197 | **Function database triggers and webhooks.** `CollectionNames.list()` is the set of collections a trigger can follow and `changeOperations()` the operations the engine reports, so PostgreSQL offers no `REPLACE`. Two bug fixes (see "Found while building"). The asset service needed nothing: it never used the feed. |
| #2199 | **Realtime source behind a token** (refactor). `REALTIME` and the `Realtime` interface in `interface-realtime`. The MongoDB adapter provides the existing service under it, and the 12 gateways inject the token instead of importing the MongoDB module. |
| #2200 | **Realtime for bucket data.** `PostgresRealtime` and `RealtimeWindow`, the expression options builder, and the engine switch in the bucket gateway. `levenshtein` moved to `@spica-server/realtime` in the same PR, as its own commit. |
| #2201 | **Sharing and skipping.** One hub per collection, a per-batch query cache, a concurrency limit, and the shortcut for updates that cannot matter. |
| #2202 | **Prefilter.** Subscriptions rule themselves out in Node when their filter or read rule is certainly false for the changed document. |
| #2203 | **Realtime for system collections.** `CollectionSource`, `Realtime.filterLanguage`, the language-aware options builder, function logs filtered by conditions. |
| this PR | **Closing.** This section, the spec sweep, and the experimental warning. |

### The change feed

- **Triggers.** One function, `spica_notify_change()`, and one sequence, `spica_change_seq`, are created at startup under an advisory lock. An `AFTER INSERT OR UPDATE OR DELETE ... FOR EACH ROW` trigger named `spica_change` calls it on every bucket table, main and child (added by `createStatements` and by a `createTriggers` step in the update plan), and on the tracked system tables (installed at startup). There is no migration, since no installation runs on PostgreSQL.
- **Update plans** drop the triggers of the tables they keep in their first step and create them again in their last, so a key change or a rewrite does not notify for every row and does not meet a stale key column.
- **Tracked system tables:** api keys, buckets, commands, configs, dashboards, env vars, function assets, function logs, functions, identities, policies, preferences, refresh tokens, secrets, users and webhooks. `jobs`, `activities`, `webhook_logs`, `statuses` and the rest are not tracked, and `watch()` on them logs a warning and never emits.
- **Notification payload** (channel `spica_change`, under 8,000 bytes): `table`, `operation`, `key`, `transaction`, `sequence`, and for updates the `columns` that changed (dropped when the payload would be too large, and then the event reports the whole document as updated). A child table reports its owner's table and key as an update with the changed top-level `fields`, because a patch that only touches a list never updates the main row. An update that changes no value sends nothing. A tracked table can name `beforeColumns` whose old values travel with updates and deletes (`function_assets` sends `key`, which the asset watcher needs on a delete).
- **Event id.** `"<table>:<sequence>"` of the first notification of a change, the same on every replica. `Coalescer` merges the notifications of one transaction per table and key (insert and update is an insert, anything and delete is a delete, insert and delete is nothing). A transaction ends when another starts, or after 25 ms of silence.
- **Listener.** `ChangeListener` holds one dedicated `pg.Client` outside the pool, started by the first `watch()` or `ready()`. It reconnects with a backoff and signals a gap (`PostgresChangeFeed.gaps`) when it is back. Events that happen while it is down are lost; there is no catch-up.
- **Reading the row.** `PostgresChangeFeed.watch(collection, options)` reads a changed bucket row through `BUCKET_QUERY` and a system row through the ORM, once per change for every subscriber, and fills `changes` by mapping changed columns to top-level fields (a field that became null is `removed`). `keysOnly` skips the read. Documents are in stored form, nothing is decrypted, as on MongoDB. Subscribers pass the same collection names as on MongoDB (`function`, `identity`, `bucket_<id>`).
- **Differences from MongoDB:** no `replace` (an update is an update), only the tracked tables, events only after commit, and a gap loses events where the MongoDB driver can resume.

### Realtime

- **Seam.** `REALTIME` (`find`, `doesEmitterExist`, `removeEmitter`, `filterLanguage`). Each adapter provides its own: `RealtimeDatabaseService` on MongoDB, `PostgresRealtime` on PostgreSQL.
- **Hub.** `RealtimeHub` holds the only feed subscription of a collection and batches its events for 10 ms. Every subscriber gets the same batch object, which carries a `BatchQueries` cache. Subscribers that ask the same thing (the same filter, sort, range, user and keys) share one query result and each gets its own copy. At most 8 subscriber evaluations run at once. The hub fails every subscriber on a gap or a feed error, with a 503.
- **Window.** `RealtimeWindow` keeps the keys a subscriber has been sent. A batch is applied one subscriber at a time: deletes the subscriber has become `Delete`; touched keys that match the filter and read rule become `Insert` or `Update`, and ones that stopped matching become `Expunge`; with a sort, skip or limit the window of keys is recomputed and diffed, with fills sent as `Initial`, keys pushed out as `Expunge`, and a sorted window's change sent as an `Order` sequence from the same `levenshtein` as MongoDB. Changes that arrive while a subscriber starts are held and applied in order after its initial query.
- **Shortcut.** An update that changes none of the fields a subscription's filter, sort or read rule reads (`fieldsOfExpression` reads them from the rule AST) is sent from the document the feed already read, with no query. It is off when the user's read applies field-level rules, because the query hides fields the feed's document still has.
- **Prefilter.** `prefilterOf` evaluates the filter and read rule against the changed document with three answers: false, true or unknown. It is used only for a key the subscriber does not hold, and only for top-level `string`, `number` and `boolean` fields. uuid (compared without regard to case), dates, hashed, encrypted and translated fields, nested paths, relations, string ordering (collation), functions and arithmetic are unknown, as are null and mistyped values. A test runs 45 filters and 18 read rules against real PostgreSQL and asserts it never rules out a document SQL returns.
- **Wire format.** Documents are keyed by the bucket's primary field (by `_id` for system collections). `Delete` and `Expunge` carry `{<key field>: key}`. There is no `Replace`.
- **Filters.** A client's `filter` is an expression on PostgreSQL; a MongoDB filter is answered with `FilterLanguageError` (404). The read rule is applied by the query (`applyAcl` and `user`); field-level rules and decryption stay in the gateway transforms, as on MongoDB. Function logs are filtered by `where` and `createdBetween` conditions.
- **Queries per change.** Measured on PostgreSQL with 20 users who each read their own documents: a new document costs 2 queries (the feed's read and the owner's check). Without the prefilter it cost 21.

### Answers to the open questions

- **Per-change filter checks on busy tables:** checked in PostgreSQL, once per distinct subscription per batch, with the work reduced by sharing, the shortcut and the prefilter. A single query for many different filters was considered and not built (see below).
- **Neutral event shape:** as above. The replica dedupe key is the sequence number, and `updateDescription` is `changes`, filled from the changed columns.
- **Listener reconnect:** a backoff, a gap signal after reconnecting, and a 503 to realtime subscribers, who reconnect. Feed consumers miss the events of the gap.

### What the plan got wrong

- **The caches** (bucket, config, env var, secret, preference, webhook definitions) never used the change feed. They use in-process dispatchers that are replicated through commands, and work on PostgreSQL as they are.
- **Realtime did not use the feed either.** `RealtimeDatabaseService` opened its own MongoDB change streams, so realtime was a new source behind a seam, not a new binding of the feed.
- **The asset service** has no feed usage; only the function asset watcher reads `function_assets`.

### Found while building

- **Two triggers on one collection lost an event on one replica (both engines).** With replication on, the enqueuer deduplicated by change id only, so a second function triggered by the same collection and operation was dropped on the replica that claimed the change first. The key is now the change id with the target's `cwd` and handler, as the schedule enqueuer does (#2197).
- **`GET /function/:id` returned the encrypted value of injected secrets on PostgreSQL.** Collection reads applied field exclusions only to the entity's own columns, not to documents resolved through a relation (#2198, merged into `postgresql`).
- **A shortcut update could carry a field the read rule hides.** Caught in review of #2201 and fixed.
- **The concurrency limiter could run one task too many** when a task arrived as a place was handed over. Fixed in #2201.
- **`FilterLanguageError` is a `NotFoundException`.** A filter in the other engine's language is a 404, not a 400.

### Differences between the engines

- A document that was just written can reach a new subscriber twice: once in its initial result and once as an `Update`, because the notice arrives after the subscription is live. The end state is the same.
- A subscriber's sort and limit are applied by PostgreSQL, so ties fall in PostgreSQL's order.
- A function `REPLACE` trigger and a webhook for `REPLACE` are not offered on PostgreSQL.
- Identity and user documents are streamed whole, including the password hash, as on MongoDB.

### Specs

- **Shared (both engines):** `contract/change-feed.spec.ts`, `contract/change-feed-system.spec.ts`, `contract/realtime.spec.ts`, `contract/realtime-system.spec.ts`; the function enqueuer database spec (`DatabaseEnqueuer`), the webhook invoker and schema specs, `memory` and `commander` of replication, and under `packages/api/function` `asset.e2e`, `http.trigger`, `grpc.trigger`, `rabbitmq*.trigger`, `rabbitmq-secret.e2e` and `secret-placeholder.integration`. `database-testing` gained `ContractEngine.sharing(module)`, `DatabaseTestingModule.connectPostgres` and `changeFeedReady(module)`.
- **PostgreSQL only:** `test/change/*` (feed, listener, coalescer, collection names), `test/realtime/*` (window, hub, subscriber, source, collection source, limiter, fields, prefilter and its comparison with SQL, integration, system), and the gateway specs `realtime.postgresql.spec.ts` for bucket data, env vars and function logs.
- **Still `mongoOnly`:**
  - the realtime specs of the gateways (bucket data, bucket schemas, dashboard, env var, secret, function, function logs, identity, user, api key, refresh token, policy) and `database.service.spec.ts`: their documents, ids and filter syntax are MongoDB's, and the PostgreSQL side is covered above;
  - `function/test/controller.spec.ts`: it waits for #2198 to reach this branch, then it can run on both engines;
  - `runtime/test/io/database.spec.ts` (stubs MongoDB's collection), the two TTL index specs of function logs and webhook logs, the two profiler specs and `identity.e2e.spec.ts` (disabled).
- `yarn check:engine-specs --strict --under=<path>/` lists nothing for `packages/api/function/`, `packages/api/replication/`, `packages/database/realtime/`, `packages/realtime/`, the realtime packages of `env_var`, `secret`, `dashboard`, `passport` and `bucket`, and `packages/data/postgresql/`.

### Requests to other parts

- **Part 11 (devkit):** nothing. The triggers live in the database, so a write made through any client is captured.
- **Part 12 (panel):** the realtime wire format of bucket data names documents by the bucket's primary field, and `Delete` and `Expunge` carry that field; a client's `filter` is an expression; the panel's function log view sends `functions`, `begin` and `content` as before.

### Open after Part 10

- **A bucket definition cache.** Each change reads the bucket definition and the row (document 06 asked for a cache with invalidation from bucket change events). `buckets` is tracked now, so the invalidation exists.
- **One query for many different filters** (a multi-predicate membership query per batch). Not built: the prefilter makes the per-user case constant, and the cost of a query that grows with the number of subscribers was not worth the changes to the planner. Revisit with a load measurement.
- **Sharing windows between subscribers.** Subscribers share query results, but each keeps its own window.
- **A key prefilter from the resource filter.** The system gateways could skip a key outside a policy's include list without a query.
- **Sensitive fields in realtime documents.** Identity and user documents carry the password hash on both engines; a fix belongs in both gateways.
- **`controller.spec.ts`** on both engines, once #2198 is part of this branch, and the first CI run of the RabbitMQ, gRPC and HTTP trigger specs on PostgreSQL, which ran only on the stacked PRs' own checks.
- **`drop` events.** Dropping a bucket does not end the realtime streams of its collection.
