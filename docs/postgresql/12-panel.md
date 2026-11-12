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
- A document's key is read through one place (`useKeyField`), never as a literal `_id`, wherever the document is a **bucket document**. System records (identity, user, policy, api key, function, env var, secret, storage object, activity, webhook, dashboard, strategy) carry their UUID v7 as `_id` on MongoDB and as `id` on PostgreSQL since Part 13. The panel reads it through the engine from `useEngine()`, and the rule editor offers `auth.id` on PostgreSQL and `auth._id` on MongoDB.
- Anything MongoDB-only (the profiler) is hidden on PostgreSQL, not left to fail.

## Depends on

- **Part 8 (merged):** the engine endpoint, the expression filter, `useEngine`, `useKeyField`, `conditionsToExpression`.
- **Part 8a (merged):** the system-domain writes the pages rely on.
- **Part 10:** the realtime socket. The panel's realtime strategy is not in this part.

## Provides

| Contract                | What later work expects                                                          |
| ----------------------- | -------------------------------------------------------------------------------- |
| Engine-aware filters    | One helper that sends a filter (object or string) and one builder per language.  |
| Key field in the panel  | Bucket rows, selection, drawer and relations use the bucket's key field.         |
| A panel test runner     | The panel's specs run in CI.                                                     |

## Not this part

- Realtime on PostgreSQL (Part 10): the websocket filter, default sort and chunk reducer.
- Server changes, except where "Decisions needed" says otherwise.

## Today

### Server side, as the panel meets it

- Facade lists that take a filter (JSON on MongoDB, an expression on PostgreSQL): identity, user, refresh token, secret, env var, storage (`/storage` and `/storage/browse`), bucket data.
- Not facade filters: policy, asset, function (`JSONP`), and every `/profile` endpoint. They stay JSON.
- **`/activity` and `/apikey` ignore `filter`.** Neither controller has the parameter. The panel's filter panels on the Activities and API key pages are no-ops on both engines. `/activity` sorts by `_id` itself.
- **`/activity` took MongoDB operators in `resource`.** The panel sent `resource={"$all":[module,bucketId],"$in":[documentIds]}`. Part 8a redefines the parameter instead of translating it: `resource` repeated (values the activity's resource list must all hold) and `documentId` repeated (ids of which it must hold any), and changes the panel's `buildActivityFilterOptions` and `getActivities` in the same PR, so the filter never breaks on MongoDB. Nothing is left to do for it here.
- **Policy filtering is client-side** (`pages/policy/Policy.tsx`) and matches a string against a MongoDB object like `{$regex}`, so any condition returns nothing. Engine-independent.
- Function logs ignore `sort`.

### Filters the panel builds (outside the bucket page)

| Area                    | Where                                                                                  | Needs                                               |
| ----------------------- | -------------------------------------------------------------------------------------- | --------------------------------------------------- |
| Identity, user pages    | `FilterPanel.tsx` calls `conditionsToMongoFilter`; the pages send its first argument   | both languages                                      |
| Storage structured filter | `utils/storageFilter.ts` (9 `$` operators), `StorageActionBar`, `useStorageData`     | both; `content.type in`, `content.size`, an OR over `created_at`/`createdAt` |
| Storage search, directory listing, file picker, rename | `StorageActionBar`, `hooks/useStorage.ts`, `StorageFileSelect.tsx`, `pages/storage/utils.ts` | both (about 20 `$` operators) |
| Relation input in the drawer | `hooks/useRelationInputHandlers.tsx` (`$or`/`$regex`)                              | an expression on PostgreSQL                          |
| Profiler                | `utils/profilerFilter.ts` (11 operators), Observability page                           | MongoDB only (`system.profile`)                      |
| `StorageContext.tsx`    | filters, never mounted                                                                 | dead code                                           |

Every list wrapper in `store/api/*.ts` (13 sites) sends `JSON.stringify(filter)`, which would quote an expression string. Types are `Record<string, any>`.

### Bucket documents read as `_id` (about 75 sites in about 17 files)

- **Table and selection:** `BucketTable.tsx`, `bucket-table/types.ts`, `useBucketColumns.ts` (also shows the key twice on PostgreSQL: an empty `_id` column and the real key column), `BucketActionBar.tsx`.
- **Page:** `pages/bucket/Bucket.tsx` (finding the open row, delete, navigation).
- **Cache:** `bucketApi.ts` patches compare `entry._id` and `sort._id === 1`; `useBucketData.ts` dedupes by `_id`.
- **Drawer:** `BucketEntryDrawer.tsx` strips `_id` from the form and the PATCH body; `BucketEntryTransformer.ts`.
- **Relations:** `RelationCell`, `RelationPicker`, `RelationMinimized`, `primaryFieldUtils`, `useRelationInputHandlers`, `encodeIdFilterConditions` (hardcodes `field: '_id'`, so a relation click filter is silently dropped on PostgreSQL).
- **Others:** `ActivityFilterPopover.tsx` (document ids into `resource.$in`), `useRuleEditor.ts` (offers `document._id`), `BucketIndexManager.tsx` (suggests `_id`).

### `_id` sorts left

`useRelationInputHandlers.tsx:58`, `bucketApi.ts:664`, and the realtime hook (Part 10).

### UUID v7 timestamp decoding

Four places decode a timestamp from the first 8 hex digits of an id as a MongoDB ObjectId does: `file-preview/utils/fileFormatters.ts`, `utils/functionLogUtils.ts`, `FunctionLogAccordionItem.tsx`, `FunctionLogChart.tsx`. On a UUID v7 they show garbage dates. A UUID v7 carries milliseconds in its first 48 bits.

### `bucket.primary` means two things

On MongoDB it is the display field of a bucket. On PostgreSQL it is the key field (`primaryKeyMetadata`). The panel uses it as a label in many places (relation labels, table sticky column, search field). `EditBucket.tsx` already creates PostgreSQL buckets with `primary: "id"` and a `uuid` property, but `createBucket` still defaults `primary` to `"title"` and deleting the primary field falls back to `"title"` (`bucketApi.ts`). The field registry has no `uuid` kind.

### Tests

Three specs exist (`field-acl.spec.ts`, `filterPanelUtils.spec.ts`, `useBucketSearch.spec.ts`) and import from `@jest/globals`. There is no `apps/panel/jest.config` and no `test` target, so CI does not run them. Hooks, slices, cache patches, the storage and profiler builders, relations, the drawer and every page are untested.

## Decisions needed

1. **API key, activity and policy filters.**
   - Remove the filter UI. Smallest, honest, and the UI does nothing today.
   - Add server support (`filter` on `/apikey` and `/activity`, server-side policy filtering). Useful, and a server change in a panel part.
   - Keep it as is. Misleading.
2. **What `bucket.primary` is on PostgreSQL.**
   - It stays the key, and the panel gets a separate display-field setting for PostgreSQL buckets (a schema change on the bucket, so a server change).
   - The panel picks the label by its own rule on PostgreSQL (first string property) and ignores `primary` for labels. No schema change, but a rule that differs by engine.
   - Reuse `primary` for both. Only workable when the key is also readable, which a uuid is not.
3. **The profiler on PostgreSQL.** Hide the Observability page, or build an equivalent on `pg_stat_statements`. Hiding is this part. The equivalent is its own piece of work and needs the extension on the server.
4. **A test runner for the panel.** Add a jest config and a `test` target, or move the specs to vitest, which the Vite setup already hints at (`/// <reference types='vitest' />`). Either way CI runs them.
5. **The storage expression builder.** One builder for `name`, `content.*` and dates, shared by the four storage call sites, or each call site keeps its own.
6. **Dead code.** Delete `StorageContext.tsx`'s filter helpers, or convert them.

## Target architecture

### Components

| Component                 | Responsibility                                                                 |
| ------------------------- | ------------------------------------------------------------------------------ |
| `serializeFilter`         | Turns a filter (object or string) into the query parameter. One place.          |
| Filter builder per engine | `conditionsToMongoFilter` / `conditionsToExpression`, plus a storage builder.   |
| `useEngine`, `useKeyField`| Already built. The only way to learn the engine and a bucket's key field.      |
| Key accessor              | `keyOf(row, keyField)` used by the table, selection, drawer and relations.      |
| `uuid` field kind         | Renders and edits a uuid key.                                                   |

## What changes

- **API wrappers:** one serialization helper for the 13 sites, widened types.
- **System pages:** identity, user and storage write the engine's filter language.
- **Observability:** hidden on PostgreSQL.
- **Bucket pages:** rows, selection, drawer and relations use the key field.
- **Relations:** the related bucket's key field and a label rule for PostgreSQL.
- **Tests:** the panel's specs run in CI.

## PR breakdown

1. A panel test runner, so every later PR brings tests that run.
2. The filter serialization helper and widened types (13 files, mechanical, behaviour-neutral).
3. Identity and user filters in the engine's language, with the decision on API key, activity and policy.
4. Storage filters (about 8 files, a new expression builder), and removal of the dead `StorageContext` code.
5. Hide the profiler on PostgreSQL.
6. UUID v7 timestamps: one helper, four call sites.
7. Bucket row identity (about 11 files): table, columns, selection, page, cache patches, drawer, transformer, activity popover, rule editor. Drops the duplicate `_id` column.
8. Relations and `bucket.primary` (8 to 10 files), per the decision, with a `uuid` field kind and `encodeIdFilterConditions` using the related key field.

Order: 1, 2 first. 3 to 6 are independent. 7 before 8.

## Open questions

- **Drawer create form.** A generated uuid key: show it read-only, or hide it? A caller-supplied key (integer, text) needs an input.
- **`useBucketSearch` on a bucket with a uuid key column.** Quick search runs a regex over searchable columns, which must exclude uuid columns.
- **Export or clipboard of bucket ids.** The survey found none, but a user can copy a key from the table.
- **Part 10 interplay.** Until realtime works on PostgreSQL, the per-bucket strategy has to fall back to HTTP when the engine is PostgreSQL.

## Done when

- Against an API on PostgreSQL: the bucket list, filter, search, sort, relations, create, edit and delete work; identity, user and storage lists filter; no page sends a request the API answers 404 or 400 for.
- Against MongoDB nothing changes.
- The panel's specs run in CI, and the filter builders for both languages are covered.

## As built

_Fill in after the last PR merges._
