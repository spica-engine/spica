# PostgreSQL support

Spica runs on MongoDB today. MongoDB calls are spread through controllers, guards, services, watchers, the devkit and deployment tooling. These documents plan PostgreSQL as a second engine.

The plan puts one **data access layer** between the API and the database. The layer picks a MongoDB or a PostgreSQL adapter at boot. Engine-specific code lives only in the adapters.

Every part is delivered as a series of small PRs. A part starts only after the parts it depends on have merged. Each part's document is self-contained. A session working on one part reads that document and the code on master, not the other documents.

## Parts

| Part                                                                       | Depends on   |
| -------------------------------------------------------------------------- | ------------ |
| [0 Data access foundation](./00-data-access-foundation.md)                 | —            |
| [1 Provisioning, connection and test setup](./01-provisioning-and-connection.md) | 0      |
| [2 System migrations](./02-system-migrations.md)                           | 1            |
| [3 System schemas](./03-system-schemas.md)                                 | 0, 1, 2      |
| [4 Expiry and housekeeping](./04-expiry-and-housekeeping.md)               | 2, 3         |
| [5 Bucket data schemas](./05-bucket-data-schemas.md)                       | 0, 3         |
| [6 Result shape](./06-result-shape.md)                                     | 0, 5         |
| [7 Access control](./07-access-control.md)                                 | 0, 5         |
| [8 Queries](./08-queries.md)                                               | 0, 5, 6, 7   |
| [8a Controller writes](./08a-controller-writes.md)                         | 3, 8         |
| [9 Writes](./09-writes.md)                                                 | 0, 5, 6, 7, 8, 8a |
| [10 Change streams and realtime](./10-change-streams-and-realtime.md)      | 0, 5, 6, 7, 8 |
| [11 Devkit](./11-devkit.md)                                                | 1, 5         |
| [12 Admin panel](./12-panel.md)                                            | 8, 8a, 10    |
| [13 Key names](./13-key-names.md)                                          | 3, 5, 8a, 9, 10 |
| [14 Query profiling](./14-query-profiling.md)                              | 1, 5, 12     |

## Rules for every PR

- **One concern per PR.** A PR is either a behaviour-neutral refactor or new engine code, never both.
- **Reviewable in one sitting.** Split large moves (for example moving callers to a facade) into batches by domain.
- **MongoDB stays green.** Existing MongoDB test suites pass unchanged in every PR.
- **New code brings its own tests.** PostgreSQL code adds tests that run on PostgreSQL in CI. Shared behaviour gets contract cases that run on both engines.
- **Specs of a part's domain are classified.** When a part makes a domain work on PostgreSQL, every spec in that domain either runs through `contractSuite` on both engines or declares `mongoOnly("reason")`. `yarn check:engine-specs --strict --under=<path>/` must list nothing for the domain before the part's last PR merges. Keep the trailing slash, or the prefix also matches sibling directories.
- **PostgreSQL was experimental** until Parts 0 to 10 had merged. Part 10 removed the warning and the markings in the options and the chart. The admin panel (Part 12) has followed; the devkit (Part 11) is still to come.
- **Keep the docs true.** The last PR of a part fills in that part's "As built" section. If a decision changes during review, update it in the part document and in the decisions table below.

## Prompt for a part session

> Read `docs/postgresql/<NN>-<part>.md` and follow its "How to use this document" section. Plan the next PR from its PR breakdown. The parts it depends on are already merged, so read their code on master and their "As built" sections. Don't open the other part documents.

## Ground rules

- **One engine per instance.** It is chosen at install time. Data is never joined across engines.
- **Same endpoints and response structure, engine-native details.** Filters follow the engine. Ids follow the engine too:
  - MongoDB: ObjectIds in `_id`, as today.
  - PostgreSQL system records: a UUID v7 `id` key that the caller may provide and PostgreSQL generates otherwise.
  - PostgreSQL bucket data: whatever primary key the bucket's owner defines.
- **The backend defines the contract; clients follow it.** Rules, schemas, contracts and implementations belong to the backend. Every client adapts to them, the admin panel, the devkit, and another server alike. What a client sends or expects today never decides the contract, and the backend does not bend to keep a client working. The reverse is allowed only when the change is harmless for every client and there is no other way out, and it is written in the part document before it is built. A part that needs a client to change lists that change in the client's own part.
- **Controllers stay engine-agnostic.** Only adapters know how each engine expresses a request.
- **No query conversion.** Each engine accepts only its own filter language, and a filter in the other language returns 404. ACL policies and bucket rules are the exception: they are engine-neutral and are rendered for the running engine.
- **Real tables for bucket data.** Bucket fields become columns, child tables and foreign keys. No JSON columns stand in for structure.
- **MongoDB adapter first.** Part 0 builds the layer on today's MongoDB code, with no behaviour change.

## Decisions

| Topic                         | Decision                                                                                                        |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Mongo operator coverage       | No conversion. A filter in the other engine's language returns 404.                                             |
| Missed change events          | Not handled for now. Spica doesn't use change stream resume today. The feed is plain LISTEN/NOTIFY.             |
| Change event shape            | Engine-neutral: `id` (the same on every replica), `operation`, `collection`, `key`, `document`, `previousDocument` and `changes`. PostgreSQL triggers send only the table, the operation and the key; the API reads the row. |
| Realtime filtering            | PostgreSQL decides, by query, in the engine's own filter language. The work is shared between identical subscriptions, skipped when an update cannot matter, and a Node prefilter may skip a subscriber it is certain a change does not concern. The database stays the authority. |
| Schema edits on large buckets | All edits run online, however long they take. None are refused, and the user is responsible for them.           |
| Devkit API shape              | A completely new devkit for PostgreSQL. `@spica-devkit/bucket` stays as it is, and callers write the filter in the expression language. |
| Existing installs             | Not supported. There is no path for moving a MongoDB instance to PostgreSQL, because MongoDB compatibility and the best key performance can't both be had. |
| ORM                           | A small ORM written in Spica, on the same driver as the bucket-data SQL. CRUD and lookups by key only; list endpoints use the query facade. |
| System migrations             | The PostgreSQL track is plain SQL migration files. They only change tables on existing installs; each has a test that runs it, is safe to run again, and nothing records what ran. |
| System table creation         | The API creates its tables at startup with `CREATE TABLE IF NOT EXISTS`, under an advisory lock so replicas don't race. New installs and test databases need no migration. |
| What a caller filter may contain | The Spica expression language, compiled to SQL with bound values and never pasted into a query. It cannot name another table or read `auth`. Written in Part 8. |
| System record ids             | A UUID v7 `id` primary key. The caller may provide it, and PostgreSQL generates it otherwise. MongoDB ObjectIds are not supported. |
| Minimum PostgreSQL version    | 18. System tables use its built-in `uuidv7()`.                                                                  |
| Key name in responses         | `_id` on MongoDB, `id` on PostgreSQL. The panel reads it through `idOf` and the bucket's key field (Part 12).   |
| Principal key in rules        | Rule text names it as the engine does: `auth.id` on PostgreSQL, `auth._id` on MongoDB. No alias, no conversion. |
| Bucket data primary keys      | Each bucket's owner picks the primary key field, its type and whether it is generated.                          |
| Chart database roles          | Like MongoDB, two roles: `root`, a superuser, and `spica`, an unprivileged role that owns the database. The API uses `spica`. |
| External database in the chart | Not offered, to match MongoDB. The chart also has no SSL option. The API can still be pointed at any server with `--database-uri`. |
| Engine in public responses    | Not reported. `GET /status/ready` is public and stays `{status: "ok"}`.                                         |
| CI services                   | Each affected project's CI job starts only the services its specs need, read from the specs by `scripts/ci-test-matrix.mjs`. |

## Stays the same

- **Admin panel:** everything except the filter builder (Part 8) and the bucket editor's primary key settings (Part 5).
- **GraphQL:** its resolvers go through the facades, and its filter argument follows the engine.
- **Bucket cache:** it caches responses by request.
- **Version control, sync and assets:** they call domain services.
- **Bucket hooks, history and activity:** they fire in-process after writes.
- **Storage object content:** it stays in the default, GCS or S3 backends.
