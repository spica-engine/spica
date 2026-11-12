# Part 12: Admin panel

## How to use this document

- Plan and implement only this part. Read the code from the parts under "Depends on" on master, along with their "As built" sections. Don't open the other documents in `docs/postgresql/`.
- If this part needs something a merged part doesn't provide, stop and list it under "Requests to other parts" in your plan instead of building it.
- Follow the PR breakdown. Each PR is either a behaviour-neutral refactor or new code, never both, and is small enough to review in one sitting.
- The panel keeps working against MongoDB in every PR.
- After the last PR, fill in "As built".

## Purpose

Makes the admin panel (`apps/panel`) usable against an API that runs on PostgreSQL. Part 8 made the bucket list filter builder, quick search, relation picker and default sort engine-aware. Everything else still assumes MongoDB.

## Rules that apply

- The panel follows the API's contract (README, "The backend defines the contract; clients follow it"). When a request the panel sends is not what the contract defines, the panel changes. What the panel needs from the server is not built to fit the panel; it goes under "Requests to other parts".
- The panel asks the API for the engine (`GET /status/engine`) and writes each filter in that language: MongoDB JSON, or an expression string on PostgreSQL. It never converts one into the other.
- A request that carries a filter waits until the engine is known.
- A document's key is read through one place (`useKeyField`), never as a literal `_id`, wherever the document is a **bucket document**. System records (identity, user, policy, api key, function, env var, secret, storage object, activity, webhook, dashboard, strategy) carry their UUID v7 as `_id` on MongoDB and as `id` on PostgreSQL since Part 13. The panel reads it through one helper, `idOf(record)`, which takes whichever of the two names the record carries, and the rule editor offers `auth.id` on PostgreSQL and `auth._id` on MongoDB.
- Anything MongoDB-only (the profiler) is hidden on PostgreSQL, not left to fail.

## Depends on

- **Part 8 (merged):** the engine endpoint, the expression filter, `useEngine`, `useKeyField`, `conditionsToExpression`.
- **Part 8a (merged):** the system-domain writes the pages rely on.
- **Part 10 (merged):** the realtime socket speaks the expression language and keys documents by the bucket's key field. The panel's realtime hook is in this part.

## Provides

| Contract                | What later work expects                                                          |
| ----------------------- | -------------------------------------------------------------------------------- |
| Engine-aware filters    | One helper that sends a filter (object or string) and one builder per language.  |
| Key field in the panel  | Bucket rows, selection, drawer and relations use the bucket's key field.         |
| A panel test runner     | The panel's specs run in CI.                                                     |

## Not this part

- Server changes, except where "Decisions needed" says otherwise.

## Today

### Server side, as the panel meets it

- Facade lists that take a filter (JSON on MongoDB, an expression on PostgreSQL): identity, user, refresh token, secret, env var, storage (`/storage` and `/storage/browse`), bucket data.
- Not facade filters: policy, asset, function (`JSONP`), and every `/profile` endpoint. They stay JSON.
- **`/activity` and `/apikey` ignore `filter`.** Neither controller has the parameter. The panel's filter panels on the Activities and API key pages are no-ops on both engines. `/activity` sorts by `_id` itself.
- **`/activity` took MongoDB operators in `resource`.** The panel sent `resource={"$all":[module,bucketId],"$in":[documentIds]}`. Part 8a redefines the parameter instead of translating it: `resource` repeated (values the activity's resource list must all hold) and `documentId` repeated (ids of which it must hold any), and changes the panel's `buildActivityFilterOptions` and `getActivities` in the same PR, so the filter never breaks on MongoDB. Nothing is left to do for it here. The panel's `ActivityFilterPopover.tsx` and `buildActivityFilterOptions` are imported nowhere, so they are dead code, and the Activities page only mounts `ActivityActionBar`.
- **Policy filtering is client-side** (`pages/policy/Policy.tsx`) and matches a string against a MongoDB object like `{$regex}`, so any condition returns nothing. Engine-independent. The server supports a JSON `filter` on `/passport/policy`, but the panel never sends one.
- Function logs ignore `sort`.

### Filters the panel builds (outside the bucket page)

| Area                    | Where                                                                                  | Needs                                               |
| ----------------------- | -------------------------------------------------------------------------------------- | --------------------------------------------------- |
| Identity, user pages    | `FilterPanel.tsx` calls `conditionsToMongoFilter`; the pages send its first argument   | both languages                                      |
| Storage structured filter | `utils/storageFilter.ts` (9 `$` operators), `StorageActionBar`, `useStorageData`     | both; `content.type in`, `content.size`, an OR over `created_at`/`createdAt` |
| Storage search, directory listing, file picker, rename | `StorageActionBar`, `hooks/useStorage.ts`, `StorageFileSelect.tsx`, `pages/storage/utils.ts` | both (about 20 `$` operators) |
| Relation input in the drawer | `hooks/useRelationInputHandlers.tsx` (`$or`/`$regex`)                              | an expression on PostgreSQL                          |
| Profiler                | `utils/profilerFilter.ts` (11 operators), Observability page                           | MongoDB only (`system.profile`)                      |
| `StorageContext.tsx`    | filters; the provider is mounted (`main.tsx`) but its hook has no consumers            | dead code                                           |

Every list wrapper in `store/api/*.ts` (13 sites) sends `JSON.stringify(filter)`, which would quote an expression string. Types are `Record<string, any>`.

### System records read as `_id` (about 540 sites)

`useKeyField` is bucket-only and no system-record code asks for the engine, so every page reads the key of an identity, user, policy, api key, function, env var, secret, storage object, activity, webhook, dashboard, strategy, refresh token and bucket schema as `_id`. The sites are TypeScript declarations (about 25 in `store/api/*.ts`, the JWT payload in `types/auth.ts`), RTK tag providers, table columns and selection, drawers (edit-or-create checks), request URLs and bodies, cache patches, the policy module renderers and the policy export, and env var and secret diffing. Two need care: `oziko-ui-kit`'s `TypeFile` pins `_id` for storage items, and the "new policy" drawer uses `_id: ""` as a sentinel. Function logs also sort by `_id` (`FunctionLogView`, `FunctionLogPage`).

### Bucket documents read as `_id` (about 75 sites in about 17 files)

- **Table and selection:** `BucketTable.tsx`, `bucket-table/types.ts`, `useBucketColumns.ts` (also shows the key twice on PostgreSQL: an empty `_id` column and the real key column), `BucketActionBar.tsx`.
- **Page:** `pages/bucket/Bucket.tsx` (finding the open row, delete, navigation).
- **Cache:** `bucketApi.ts` patches compare `entry._id` and `sort._id === 1`; `useBucketData.ts` dedupes by `_id`.
- **Drawer:** `BucketEntryDrawer.tsx` strips `_id` from the form and the PATCH body; `BucketEntryTransformer.ts`.
- **Relations:** `RelationCell`, `RelationPicker`, `RelationMinimized`, `primaryFieldUtils`, `useRelationInputHandlers`, `encodeIdFilterConditions` (hardcodes `field: '_id'`, so a relation click filter is silently dropped on PostgreSQL).
- **Others:** `ActivityFilterPopover.tsx` (document ids into `resource.$in`), `useRuleEditor.ts` (offers `document._id`), `BucketIndexManager.tsx` (suggests `_id`).

### `_id` sorts left

`useRelationInputHandlers.tsx:58`, `bucketApi.ts:663`, `StorageFileSelect.tsx:177`, the function log views, and the realtime hook, which also keys documents by `_id` (4 sites) and sends its filter as quoted JSON.

### UUID v7 timestamp decoding

Four places decode a timestamp from the first 8 hex digits of an id as a MongoDB ObjectId does: `file-preview/utils/fileFormatters.ts`, `utils/functionLogUtils.ts`, `FunctionLogAccordionItem.tsx`, `FunctionLogChart.tsx`. On a UUID v7 they show garbage dates. A UUID v7 carries milliseconds in its first 48 bits.

### `bucket.primary` means two things

On MongoDB it is the display field of a bucket. On PostgreSQL it is the key field (`primaryKeyMetadata`). The panel uses it as a label in many places (relation labels, table sticky column, search field). `EditBucket.tsx` already creates PostgreSQL buckets with `primary: "id"` and a `uuid` property, but `createBucket` still defaults `primary` to `"title"` and deleting the primary field falls back to `"title"` (`bucketApi.ts`). The field registry has no `uuid` kind.

### Tests

Three specs exist (`field-acl.spec.ts`, `filterPanelUtils.spec.ts`, `useBucketSearch.spec.ts`) and import from `@jest/globals`. There is no `apps/panel/jest.config` and no `test` target, so CI does not run them. Hooks, slices, cache patches, the storage and profiler builders, relations, the drawer and every page are untested.

## Decisions

1. **API key, activity and policy filters.** Remove the filter UI on Activities and API key, which does nothing today. The server is not changed. Policy filtering stays client-side and is fixed to match plain strings.
2. **What `bucket.primary` is on PostgreSQL.** It stays the key. The panel picks a label by its own rule on PostgreSQL (the first string property) and ignores `primary` for labels. No schema change.
3. **The profiler on PostgreSQL.** Hidden by the engine until Part 14 builds a `pg_stat_statements` equivalent. Then it follows the server's `features.profiler` (PR 14 below).
4. **A test runner for the panel.** Jest, with a standalone config, because the specs already import `@jest/globals` and nothing new needs installing. Only pure functions are tested for now.
5. **The storage expression builder.** One builder shared by the storage call sites.
6. **Dead code.** `StorageContext.tsx` and `ActivityFilterPopover.tsx` are deleted.
7. **System-record keys.** All system pages read the key through `idOf`, not just the pages the first draft of this document listed.
8. **Realtime.** Part 10 has merged, so the panel's realtime hook is in this part.

## Target architecture

### Components

| Component                 | Responsibility                                                                 |
| ------------------------- | ------------------------------------------------------------------------------ |
| `serializeFilter`         | Turns a filter (object or string) into the query parameter. One place.          |
| Filter builder per engine | `conditionsToMongoFilter` / `conditionsToExpression`, plus a storage builder.   |
| `useEngine`, `useKeyField`| Already built. The only way to learn the engine and a bucket's key field.      |
| `idOf(record)`            | Reads a system record's key, whichever of `_id` and `id` it carries.            |
| Key accessor              | `keyOf(row, keyField)` used by the table, selection, drawer and relations.      |
| `uuid` field kind         | Renders and edits a uuid key.                                                   |

## What changes

- **API wrappers:** one serialization helper, widened types.
- **System pages:** every page reads keys through `idOf`; identity and user write the engine's filter language; the dead filter panels go.
- **Storage:** one expression builder.
- **Observability:** hidden on PostgreSQL.
- **Bucket pages:** rows, selection, drawer and relations use the key field.
- **Relations:** the related bucket's key field, a label rule for PostgreSQL and a `uuid` field kind.
- **Realtime:** the hook uses the key field, the default sort and the expression filter.
- **Tests:** the panel's specs run in CI, and the ratchet covers the panel.

## PR breakdown

1. Panel test runner and these corrections.
2. The filter serialization helper and widened types (15 sites, mechanical, behaviour-neutral).
3. `idOf` and the `SystemRecord` type.
4. System-record keys, one PR per domain, behaviour-neutral on MongoDB: (a) identity, user, refresh token; (b) api key, policy; (c) function, env var, secret, function logs; (d) storage and file preview; (e) activity, webhook, dashboard, strategy, login, JWT; (f) bucket schemas.
5. Identity and user filters in the engine's language; remove the Activities and API key filter UI and `ActivityFilterPopover`; fix the policy filter.
6. Storage filters (a shared expression builder) and removal of `StorageContext`.
7. Hide the profiler on PostgreSQL.
8. UUID v7 timestamps: one helper, four call sites.
9. Rule editor principal key: `auth.id` or `auth._id` by engine.
10. Bucket row identity: table, columns, selection, page, cache patches, drawer, transformer. Drops the duplicate `_id` column.
11. Relations and labels, with a `uuid` field kind and `encodeIdFilterConditions` using the related key field.
12. Realtime on PostgreSQL.
13. The key name ratchet covers the panel, and "As built".
14. After Part 14's endpoints have merged: the profiler gate reads `features.profiler` from `GET /status/engine` instead of the engine name, and the Observability page shows a statements table on PostgreSQL (query, calls, total, mean, max, rows, cache hit ratio), filtered and sorted in the expression language. The hidden routes and the rail item come back when the server reports the profiler on.

Order: 1 to 3 first. 14 waits for Part 14. 4 needs 3. 5 needs 2. 6 needs 1 and 2. 7 to 9 are independent. 10 needs 3. 11 and 12 need 10. 13 is last.

## Open questions

- **Drawer create form.** A generated uuid key: shown read-only. A caller-supplied key (integer, text) needs an input.
- **`useBucketSearch` on a bucket with a uuid key column.** Quick search runs a regex over searchable columns, which must exclude uuid, integer and bigint columns.
- **Export or clipboard of bucket ids.** The survey found none, but a user can copy a key from the table.

## Done when

- Against an API on PostgreSQL: the bucket list, filter, search, sort, relations, create, edit and delete work; identity, user and storage lists filter; no page sends a request the API answers 404 or 400 for.
- Against MongoDB nothing changes.
- The panel's specs run in CI, and the filter builders for both languages are covered.

## As built

_Fill in after the last PR merges._
