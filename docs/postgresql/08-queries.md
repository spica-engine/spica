# Part 8: Queries

## How to use this document

- Plan and implement only this part. Read the code from the parts under "Depends on" on master, along with their "As built" sections. Don't open the other documents in `docs/postgresql/`.
- If this part needs something a merged part doesn't provide, stop and list it under "Requests to other parts" in your plan instead of building it.
- Follow the PR breakdown. Each PR is either a behaviour-neutral refactor or new engine code, never both, and is small enough to review in one sitting.
- Existing MongoDB suites stay green. New code brings its own tests in the PostgreSQL CI job.
- After the last PR, fill in "As built".

## Purpose

Makes reads work on PostgreSQL behind the query facade. It takes the caller's filter in the running engine's language and combines it with:

- ACL
- relations
- locale
- field selection
- sort and paging

It returns documents in today's shape.

## Rules that apply

- No conversion between languages. Mongo filters run on MongoDB and SQL filters run on PostgreSQL.
- A filter in the other engine's language returns 404.
- Caller SQL filters are parsed against an allow-list and rebuilt with bound values, never pasted into a query. They can't reach other tables, use subqueries or get around ACL. This part writes the allow-list.
- Controllers stay engine-agnostic.

## Depends on

- **Part 0 (merged):** the query facade.
- **Part 5 (merged):** table metadata.
- **Part 6 (merged):** the PostgreSQL result shaper and its row set format.
- **Part 7 (merged):** SQL renderers for resource filters, rules and field rules.

## Provides

| Contract                | What later parts expect                                                                                    |
| ----------------------- | ---------------------------------------------------------------------------------------------------------- |
| PostgreSQL query path   | The query facade fully working on PostgreSQL for every domain.                                             |
| SQL filter parser       | Parses and checks a caller SQL filter for a given bucket or domain. Realtime (Part 10) reuses it.           |
| Filter language check   | Decides whether a filter is in the running engine's language.                                              |
| Load by key with relations | Loads a record by its primary key (`id` for system records, the bucket's own key for bucket data), with relations. Used by write rules (Part 9) and change events (Part 10). |

## Not this part

- Writes (Part 9).
- Realtime subscriptions (Part 10).
- The devkit (Part 11).

## Today

- On MongoDB, the facade uses today's generic and bucket pipeline builders.
- Callers send Mongo JSON filters, or Spica expression filters on buckets.
- Pagination totals come from today's facet-based plan.

## Target architecture

### Components

| Component               | Responsibility                                                                                              |
| ----------------------- | ----------------------------------------------------------------------------------------------------------- |
| Filter language check   | Accepts the engine's language and returns 404 for the other one. It must not break expression filters on MongoDB. |
| SQL filter parser       | Builds an AST from the caller's filter, checks it against the allow-list and the bucket's columns, and renders it with bound values. |
| SQL query builder       | Combines the conditions, joins, locale, field selection, order, limit and offset.                         |
| Totals                  | Counts for pagination on PostgreSQL.                                                                        |
| PostgreSQL read runner  | Runs the query, groups rows into a row set and hands it to the shaper.                                     |

### Flow

1. A controller calls the query facade. The controller doesn't change.
2. The filter language check accepts the filter or returns 404.
3. On PostgreSQL:
   1. The SQL filter parser checks the filter.
   2. Part 7's renderers add ACL.
   3. The query builder adds relations, locale, fields, sort and paging.
4. The read runner runs the query and the result shaper returns documents.

## What changes

- **Facade:** a new PostgreSQL implementation.
- **Admin panel:** the filter builder writes the running engine's language. It reads the engine from the status endpoint.
- **GraphQL:** passes its filter argument through the facade.
- **Suites:** list-endpoint suites for every domain opt in to the PostgreSQL CI job.

## PR breakdown

1. Filter language check and the 404 response on both engines. It must keep JSON and expression filters working on MongoDB.
2. SQL filter parser and allow-list. Pure, with unit tests only.
3. Query builder for one bucket table: conditions, ACL, fields, sort, paging, totals.
4. Relations: joins on foreign keys and link tables, using each bucket's own primary key.
5. Locale.
6. List endpoints of system domains on PostgreSQL.
7. GraphQL on PostgreSQL.
8. Panel filter builder.

## Open questions

- **Spica expression filters** (`?filter=` with an expression) use the same engine-neutral language as rules, and Part 7 already compiles that language to SQL. Should expression filters work on both engines, or only on MongoDB?
- **Language detection:** how do we tell a Mongo JSON filter from an SQL filter reliably? Parse failure, or an explicit parameter?

## Done when

- Bucket reads with relations, locale, ACL, field rules, sort and paging return the same document shape on both engines, each with a filter in its own language.
- A filter in the wrong language returns 404.
- An SQL filter that reaches outside its table, or around ACL, is rejected.
- The `legacyPlan` helper in `packages/data/mongodb/test/collection-query.spec.ts` is removed. It rebuilds the old `PipelineBuilder` plan only to prove Part 0 changed nothing, and it is redundant once every read goes through the facade.

## As built

_Fill in after the last PR merges._
