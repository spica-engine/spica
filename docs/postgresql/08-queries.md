# Part 8: Queries

## How to use this document

- Plan and implement only this part. Read the code from the parts under "Depends on" on master, along with their "As built" sections. Don't open the other documents in `docs/postgresql/`.
- If this part needs something a merged part doesn't provide, stop and list it under "Requests to other parts" in your plan instead of building it.
- Follow the PR breakdown. Each PR is either a behaviour-neutral refactor or new engine code, never both, and is small enough to review in one sitting.
- Existing MongoDB suites stay green. New code brings its own tests, which run on PostgreSQL in CI. Shared behaviour uses contract suites.
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

- No conversion between languages. A MongoDB JSON filter runs on MongoDB and is a 404 on PostgreSQL.
- Both engines read the Spica expression language as a string filter. Only the engine-neutral expression language is shared, so there is no SQL text filter.
- A caller's expression is compiled to SQL with bound values, never pasted into a query. The grammar has no way to name another table, write a subquery or get around ACL, and fields resolve only against the bucket's or collection's own metadata.
- Controllers stay engine-agnostic.

## Depends on

- **Part 0 (merged):** the query facade.
- **Part 5 (merged):** table metadata.
- **Part 6 (merged):** the PostgreSQL result shaper and its row set format.
- **Part 7 (merged):** SQL renderers for resource filters, rules and field rules.

## Provides

| Contract                    | What later parts expect                                                                                                                                      |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| PostgreSQL query path       | The query facade fully working on PostgreSQL for every domain.                                                                                                 |
| Caller filter compiler      | `compileFilter` (bucket), `compileFilterIn` (any `FieldResolver`) and `compileFilterNode` (a tree). Realtime (Part 10) reuses it.                              |
| Filter language check       | `assertFilterLanguage(filter, accepted, engine)` returns a 404 for the other engine's language.                                                              |
| Load by key with relations  | `BUCKET_QUERY.findOne(bucket, {documentId, relationPaths}, context)` for bucket data, and `COLLECTION_QUERY.findOne(name, {id, relations})` for system records. |

## Not this part

- Writes (Part 9).
- Realtime subscriptions (Part 10).
- The devkit (Part 11).

## Decisions

- **Expression filters work on both engines.** They are the one string filter language. PostgreSQL has no SQL text filter and no SQL parser of its own.
- **Language detection is the leading `{`.** A filter that starts with `{` is MongoDB JSON and anything else is an expression. An empty filter (`{}`, an empty string) belongs to every language.
- **The language is extended only as far as caller filters need.** `in`, `startsWith` and `contains` are added on both engines. Everything else is added on demand.
- **`auth` is not available in a caller filter.**

## Target architecture

### Components

| Component             | Responsibility                                                                                                                                    |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Filter language check | `FILTER` pipe keeps a string that does not start with `{`; facades call `assertFilterLanguage`.                                                    |
| Caller filter compiler | `compileFilter*` over the rule compiler, with `auth` refused and size limits. A `FieldResolver` says how a name becomes a column.                  |
| Bucket query          | One `SELECT` with the key, resource filter, read rule, expression filter, conditions, sort and paging; one query per child table; relations level by level. |
| Collection query      | The same for system collections, over the columns of their entity.                                                                                |
| Totals                | Counts for pagination on PostgreSQL.                                                                                                                |
| Read runner           | `readOnly`: a read-only, repeatable-read transaction with a statement timeout, and generic database errors.                                       |

### Flow

1. A controller calls the query facade. The controller doesn't change.
2. The facade checks the language of the filter, or answers 404.
3. On PostgreSQL the plan adds the key, the resource filter, the ACL read rule and the caller's filter as one `(acl) AND (filter)` condition, then sort and paging.
4. The runner fetches the page, the child tables of the page and the relations level by level, and the result shaper returns documents.

## What changes

- **Facade:** a PostgreSQL implementation for buckets and for collections.
- **Admin panel:** the bucket filter builder, the quick search and the relation picker write the running engine's language. `GET /status/engine` tells an authenticated caller the engine.
- **GraphQL:** its `query` argument goes through the facade as a condition tree each engine renders.
- **Suites:** the contract suites of the facades run on both engines.

## PR breakdown

Delivered as these PRs:

1. Key types from the bucket's metadata (refactor).
2. Filter language check and the 404.
3. Pluggable field resolution in the rule compiler (refactor).
4. Memoized expression parser (refactor of the parser's cost, not its result).
5. Caller filter compiler.
6. The `in` operator.
7. `startsWith` and `contains`.
8. Bucket reads.
9. Relations.
10. Locale.
11. System collection reads.
12. GraphQL queries through the facade.
13. Admin panel filters, with the engine endpoint.
14. Closing: `legacyPlan` removed and this document.

## Done when

- Bucket reads with relations, locale, ACL, field rules, sort and paging return the same document shape on both engines, each with a filter in its own language.
- A filter in the wrong language returns 404.
- A filter that reaches outside its table, or around ACL, is rejected.
- The `legacyPlan` helper in `packages/data/mongodb/test/collection-query.spec.ts` is removed.
- Part 8a (controller writes) is merged, so the system-domain specs run on both engines and none is unclassified or failing.

## As built

### Filters

- `FILTER` pipe (`packages/core/src/pipes.ts`): a string starting with `{` is parsed as JSON (400 on broken JSON); any other string stays a string. It replaced `JSONP` on the `filter` of identity, user, refresh token, secret, env var and storage lists. `ReadSpec.filter` is `object | string`.
- `assertFilterLanguage` and `FilterLanguageError` (a `NotFoundException`) are in `@spica-server/data`. MongoDB accepts JSON on collections and the storage browse, and JSON or an expression on buckets. PostgreSQL accepts an expression only. Policy, asset and the `/profile` endpoints still read JSON and are not facade reads.
- The expression grammar was not linear: parse time doubled with each level of nested brackets (16 levels took about 200 ms). `cache: true` in the PEG parser makes it linear. This also protects the MongoDB `?filter=` and saved rules.
- Added to both engines: the `in` operator (it was in the grammar but neither engine evaluated it), `startsWith(field, text)` and `contains(field, text)`. On PostgreSQL `in` is a chain of equalities, so values convert like in a comparison, and the text functions are `LIKE` with an escaped, bound pattern. On MongoDB the text functions match only text.
- `compileFilter` (`access/rule/filter.ts`) refuses `auth`, and refuses a filter over 4096 characters, 32 levels deep or with more than 64 terms (operators, calls and negations; the fields and literals a comparison names are not counted). Tests pin an injection corpus and a seeded fuzz run.

### Bucket reads (`packages/data/postgresql/src/query/bucket/`)

- `PostgresBucketQueryFacade` is bound to `BUCKET_QUERY`. The plan applies, in order, the key, the resource filter, the read rule (only with `applyAcl`, a never-true rule returns nothing without a query), the expression filter and `where`, then sort and paging. Field rules, `projectMap` and decryption follow the shaping.
- Sort is a main-table column (or a translated property while localizing), ends with the key for stable paging, and puts missing values first when ascending, as MongoDB does.
- Children: one query per child table for the whole page. Relations: `relationPaths` with the trailing `_id` dropped, resolved level by level with one query per relation, up to five levels deep, using the target's own primary key. A relation the field rules hide or the projection leaves out is not fetched.
- Locale: `localize` on a bucket with translated properties resolves `{best, fallback}` like MongoDB, passes it to the shaper and returns it. A translated property compiles to a lookup of its best, then fallback, translation, so filters, read rules and sort see the localized text.
- Reads run in a `READ ONLY` `REPEATABLE READ` transaction with a 30 second statement timeout. Database errors reach the caller as "The query could not be completed." or "The query took too long.".
- Totals: exact whenever the key, resource filter, rules or filter narrow the result. An unfiltered table is estimated from `pg_class.reltuples` only from 10 000 rows up. This differs from MongoDB, which estimates the whole collection whenever only a resource filter applies.
- `PostgresIdTypes.forBucket` reads the key type of the bucket's primary (uuid, integer, bigint or text). Integer, bigint and text keys cannot be generated (`generate()` throws), because the database or the caller assigns them.

### System collection reads (`src/query/collection/`)

- `PostgresCollectionQueryFacade` replaced the placeholder. `COLLECTION_ENTITIES` maps the names controllers use (`identity`, `env_var`, `function_logs`, ...) to entities. A filter names the properties documents use; secret columns (`password`, `lastPasswords`, `encrypted`, `iv`, `authTag`, `secret`, and the api key, refresh token and verification code) cannot be used in a filter, a `where` condition or a sort.
- Supported: `id`, `resourceFilter`, `where` (`eq`, `in`, `matches` as a POSIX regex), `createdBetween`, `fields` (inclusion or exclusion), `sort`, `skip`, `limit`, `paginate` with both strategies, and the relations MongoDB resolves: activity `identifier` and `username` (the name stands in for the id, and `where` compares the name), function `env_vars` and `secrets` (the documents), function logs `function` (the name, or the id when the function is gone).
- `filterReplacers` is MongoDB-shaped and ignored on PostgreSQL. `StorageRepository.browse` takes the same expression filter over the storage columns.

### GraphQL

- The resolver no longer builds a MongoDB filter. `parseQuery` (schema-aware, in the GraphQL package) turns the `query` argument into a `FilterNode` tree (`@spica-server/interface-bucket-common`), passed as `BucketReadSpec.where`. MongoDB renders it to the same `$` filter as before, including `ObjectId` keys, and accepts any `field_operator` suffix. PostgreSQL renders it to expression nodes and supports `eq`, `ne`, `gt`, `gte`, `lt`, `lte`, `in`, `nin` and `regex`, and answers 400 for the rest. The GraphQL package no longer imports `ObjectId`.
- Not done: `FindBy…Id(_id: ObjectId!)` and the mutations still assume MongoDB keys.

### Admin panel

- `GET /status/engine` returns `{engine}` for an authenticated caller (no permission needed, or users without `status:index` could not load a bucket list). The `DATA_ENGINE` token moved to `@spica-server/interface-data`.
- `useEngine`, `useKeyField`, `conditionsToExpression` and `combineFilters` write the bucket filter builder, quick search and relation picker in the engine's language, and sort by the key field. The panel's own spec (`filterPanelUtils.spec.ts`) pins the expressions it writes; it has no test runner yet, which Part 12 adds.
- Not done: the other pages that build filters (storage, profiler, users, identities, api keys, policies, activity, and the realtime strategy), and every place that reads `_id` from a document.

### Differences between the engines

- Ordering a missing value: `document.age < 25` also matches a document with no `age` on MongoDB, and does not on PostgreSQL (NULL).
- A one-to-many relation returns the targets in the stored order on PostgreSQL and in collection order on MongoDB.
- A document with neither the requested nor the default language keeps its translation map on MongoDB. Sorting by such a field puts it last on MongoDB and first on PostgreSQL.
- `createdBetween` is the creation time of the id on MongoDB and the `created_at` column on PostgreSQL. A collection without that column compares the time inside the UUID v7 id, clamped to the 48 bits it holds.
- Unset values are `null` in a PostgreSQL document and absent in a MongoDB one.

### Blocks the completion of this part

- **Part 8a (controller writes) has to merge before this part does.** The system-domain controller specs create their data through the controllers, and a write through the controller does not work on PostgreSQL: `POST /env-var`, `/dashboard` and `/bucket` return no `_id`, because their `crud.insert` returns the object it passed and relies on MongoDB's driver to add the `_id`, while the PostgreSQL ORM returns a new record. Until that is fixed the specs cannot run on both engines, and a part is not accepted with unclassified or failing specs. 117 specs in the repository use the MongoDB testing module without being classified. `08a-controller-writes.md` plans the fix and the conversion.

### Left for other parts

- `BUCKET_DATA_REPOSITORY` is still not bound on PostgreSQL, so the bucket HTTP module does not boot there. Bucket reads are covered at the facade, not through the controller.
- The temporary test helpers `access-store.ts` and `row-set-fixtures.ts` (`insertDocument`) wait for Part 9. The resource store and the `fetchRowSet` of the bucket store are gone.
