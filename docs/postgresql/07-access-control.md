# Part 7: Access control

## How to use this document

- Plan and implement only this part. Read the code from the parts under "Depends on" on master, along with their "As built" sections. Don't open the other documents in `docs/postgresql/`.
- If this part needs something a merged part doesn't provide, stop and list it under "Requests to other parts" in your plan instead of building it.
- Follow the PR breakdown. Each PR is either a behaviour-neutral refactor or new engine code, never both, and is small enough to review in one sitting.
- Existing MongoDB suites stay green. New code brings its own tests, which run on PostgreSQL in CI. Shared behaviour uses contract suites.
- After the last PR, fill in "As built".

## Purpose

Renders access control for PostgreSQL. Policies produce include and exclude lists of resource ids. Bucket read rules and field-level rules are Spica expressions. Neither is written in SQL or Mongo syntax. Each is rendered into the running engine's language as late as possible, as already happens for MongoDB.

## Rules that apply

- Policies and rules are engine-neutral. They are the only things rendered differently per engine. Caller filters are not converted.
- Policy evaluation (`AuthGuard`, `ActionGuard`) doesn't change.

## Depends on

- **Part 0 (merged):** the query facade, which takes the resource filter.
- **Part 5 (merged):** table metadata, so rule paths, including relation paths, resolve to tables, columns and joins.

## Provides

| Contract                   | What later parts expect                                                                              |
| -------------------------- | ---------------------------------------------------------------------------------------------------- |
| Neutral resource filter    | `@ResourceFilter()` returns include and exclude ids with no engine syntax.                           |
| Resource filter renderers  | MongoDB `$match` (today's), and an SQL condition on the table's primary key, typed by its key definition. |
| SQL rule compiler          | Compiles a rule's AST into an SQL condition with bound values, plus the joins it needs.             |
| SQL field rules            | Compiles field-level rules into which fields to return or hide per record.                           |
| Built-in function forms    | Every built-in expression function has an SQL form.                                                 |

## Not this part

- Plugging the compiled SQL into reads (Part 8).
- Loading related records for write rules (Part 9).
- Realtime ACL (Part 10).
- Caller filters (Part 8).

## Today

- `ActionGuard` puts include and exclude ids on the request. `@ResourceFilter()` turns them into a Mongo `$match`.
- The expression package parses a rule into an AST:
  - **Project mode** compiles the AST into a Mongo aggregation expression.
  - **Match mode** evaluates it in memory.
- Field-level rules compile into `$cond` projections.
- Replacers resolve related and hashed fields used in a rule before compiling, which can need database reads.

## Target architecture

### Components

| Component                 | Responsibility                                                                     |
| ------------------------- | ---------------------------------------------------------------------------------- |
| Neutral resource filter   | Include and exclude ids, as data.                                                  |
| MongoDB renderers         | Today's `$match` and project-mode compiler, moved behind the adapter.             |
| SQL renderer              | Turns a neutral resource filter into a condition on the table's primary key: `id` for system tables, the user-chosen key for buckets. |
| SQL rule compiler         | Walks the same AST and produces conditions and joins.                             |
| SQL field rules           | Produce per-field visibility.                                                     |
| Replacer reads            | Go through the query facade rather than collections.                              |

### Flow

1. `@ResourceFilter()` returns the neutral filter.
2. The facade passes the filter, the read rule and the field rules to the running adapter.
3. The adapter renders them: Mongo stages on MongoDB, SQL conditions, joins and field visibility on PostgreSQL.

## What changes

- **`@ResourceFilter()`:** returns the neutral form. Today `resourceFilterFunction` in `passport/guard/src/action.guard.ts` still builds `{_id: {$in}}` and `{_id: {$nin}}` itself. That construction moves behind the MongoDB adapter, so no MongoDB syntax is built in the guard.
- **The expression package:** gets an SQL output alongside the Mongo one.
- **Replacers:** read through the facade.

## PR breakdown

1. Neutral resource filter, with MongoDB rendering it exactly as today. This is a behaviour-neutral refactor.
2. SQL resource filter renderer.
3. SQL rule compiler for operators, identifiers and literals.
4. SQL forms for built-in functions.
5. Relation paths in rules, compiled to joins, and replacers reading through the facade.
6. SQL field-level rules.

## Open questions

- Is any built-in expression function impossible to express in SQL? If so, does the rule fail to save on PostgreSQL, or fail when it runs?

## Done when

- The SQL compiler and renderer produce correct conditions for every rule in the existing expression test cases.
- No MongoDB syntax for access control is built outside the MongoDB adapter, including the `$in` and `$nin` stages in the action guard's resource filter.

## As built

### Neutral resource filter

- `ResourceFilterSpec` (`{include: string[]; exclude: string[][]}`) is in `packages/interface/data/src/query.ts`. `ReadSpec.resourceFilter` and `BucketReadSpec.resourceFilter` use it. Each exclude list belongs to one policy statement, and the statements and the include list are alternatives of each other.
- `resourceFilterFunction` returns `request.resourceFilter` as it is. The guard builds no `$in`, `$nin` or `$or` and no longer calls `ids()`.
- The MongoDB rendering is `renderResourceFilter` in `packages/database/pipeline/src/resource-filter.ts`. `MongoCollectionQueryFacade`, `MongoBucketQueryFacade` and `RealtimeDatabaseService` call it. The plan's `RESOURCE_FILTER_RENDERER` token was not needed: the realtime service already lives with the MongoDB code, so it renders the filter itself. `RealtimeOptionsBuilder` keeps the neutral filter on the options. Part 10 replaces that.
- `{pure: true}` and the storage browse filter (glob patterns) are unchanged.

### SQL resource filter

`resourceFilterCondition(filter, parse)` in `packages/data/postgresql/src/access/resource-filter.ts` returns an ORM `Condition`: `("id" <> ALL($1::uuid[]) OR … OR "id" = ANY($n::uuid[]))`, or `TRUE` for an empty filter. Ids are parsed and deduplicated when the condition is built. `keyParser(type)` parses ids by the key type of the table (`uuid`, `integer`, `bigint`, `text`). The condition works with the ORM (`{id: condition}`) and as raw SQL on a bucket table's key column.

### SQL rule compiler

`compileRule(rule, scope, values)` in `packages/data/postgresql/src/access/rule/` returns `{sql, joins, constant?}`. It walks the AST from `@spica-server/bucket-expression/src/parser`, so the expression package has no SQL in it and no MongoDB driver is loaded.

- **Folding.** Anything that does not touch a column (`auth.*`, literals) is evaluated while compiling. `true==true` becomes `TRUE`. Placeholders are numbered after folding, so a dropped subtree leaves no unused parameter.
- **NULL.** `!=` is `IS DISTINCT FROM`, `== null` is `IS NULL`, and `!` wraps its operand in `COALESCE(…, FALSE)`. A row with a NULL field is therefore still kept by `!(…)`, as on MongoDB. Plain `col = $1` and `col > $1` stay usable by indexes.
- **Values.** Each bound value is cast to the type of the field it is compared with. A value that cannot be of that type decides `==` and `!=` itself and makes ordering an error. Date strings and hash conversion apply to string literals in the rule only, as the MongoDB replacers do, never to values from `auth`.
- **Arithmetic.** Whole numbers use `bigint`, anything else `double precision`. A zero divisor gives NULL instead of failing the query.
- **Built-in functions.** All eight have an SQL form. Lists are read from their child table with `EXISTS` and `ARRAY(SELECT …)`; the second argument of `some`, `every` and `equal` is an array literal or a list from `auth`, as on MongoDB.

  | Function | SQL |
  | --- | --- |
  | `has` | `IS NOT NULL`, or `EXISTS` of rows for a list |
  | `some` / `every` / `equal` | `EXISTS … = ANY(list)`, `list <@ ARRAY(…)`, `COUNT(*) = n AND BOOL_AND(… = ANY(list))` |
  | `length` | rows of a list, `char_length`, guarded `jsonb_array_length` |
  | `regex` | `~` or `~*` |
  | `unixTime`, `now` | `EXTRACT(EPOCH …)`, a bound number fixed at compile time |

- **Relation paths.** `loadRelatedBuckets(own, rules, find)` loads, before compiling, only the related buckets the rules reach. One-to-one paths become many-to-one `LEFT JOIN`s, aliased by a hash of the relation path so they share and fit 63 bytes; a path that ends at the related bucket's key reads the foreign-key column and joins nothing. Joins that folding made unnecessary are not returned. The caller adds `joins` to its `FROM` clause, using the main table alias it passed as `scope.table`. A one-to-many relation can be used with the list functions only (`some(document.editors.name, […])` runs inside `EXISTS` over the link table).
- **Replacers.** The MongoDB replacers only read bucket definitions through `options.resolve` (`BucketService.resolveSchema`), never a collection, so they already read through an engine-neutral hook and were left alone. The SQL compiler converts values from the field types and does not use them.
- **Errors.** `InvalidRuleError` (syntax, an unknown field or function, a wrong argument) and `UnsupportedRuleError`, both `RuleCompileError`.

### SQL field rules

`compileFieldRules(scope, values)` (`access/field-rules.ts`) handles the top-level `properties[x].acl` rules, as MongoDB does. A rule that always holds is not listed, one that never holds goes to `hidden`, and any other becomes a flag column `_visible_n`. `visibilitySelect(rules)` gives the `COALESCE(rule, FALSE) AS "_visible_n"` expressions for the select list, and `applyVisibility(document, row, rules)` removes the hidden fields from the shaped document. A NULL result hides the field, as `$cond` does. The flags ride in `RowSet.main`; the shaper only reads the described columns, so Part 6's contract did not change.

### Saving a bucket

`BUCKET_RULE_VALIDATOR` (`packages/interface/bucket/src/rule-validator.ts`) is bound by both adapters. `ruleValidation` in `packages/api/bucket/src/crud.ts` calls `validateReadRule` and `validateFieldRules`, so a rule PostgreSQL cannot apply is a 400 when the bucket is saved. The MongoDB validator is the old read check, moved behind the adapter, and does not check field rules (it never did). Write rules are evaluated in memory, so their check is unchanged. A bucket that has no table layout, or a relation to a missing bucket, is left to the schema manager.

### Open question

No built-in function is impossible in SQL. What cannot be expressed fails when the bucket is saved: regular expression flags other than `i`, PCRE-only syntax (lookbehind, named groups, `\p{}`, atomic groups), a list used as a value, and the unsupported syntax listed below.

### Differences from MongoDB

- `== null` is true for a field with no value; MongoDB's aggregation `$eq` is false for a missing field and true for an explicit `null`.
- `has` on a list means the list has rows; PostgreSQL cannot tell an empty list from a missing one.
- A zero divisor yields NULL, not an error.
- Ordering a field against `null` is refused.
- Decimal literals (`2.5`) are refused: the float rule in `grammar.pegjs` binds its action to its second alternative only, so `2.5` parses to a raw match array on both engines. Tracked in [#2133](https://github.com/spica-engine/spica/issues/2133); the fix is a one-line change that also repairs MongoDB.
- Encrypted fields cannot be used in a rule (see below).
- `in`, indexing, map and bytes literals, and negative numbers are refused, as they already fail at run time on MongoDB.

### Requests to other parts

- **Part 9:** store a deterministic hash next to an encrypted value, so a rule can compare it. Part 5 maps `encrypted` to one `text` column and is merged, so this is a layout change that ships with the first write of encrypted values. The request, the code to change and the tests that pin the refusal (marker `[part9-encrypted]`) are in `09-writes.md`, "Requests from other parts".
- **Part 5:** `PostgresIdTypes.forBucket` still returns uuid for every bucket. `keyParser` reads the key type from `PrimaryKeyMetadata` instead.
- **Part 8:** bind `COLLECTION_QUERY` and `BUCKET_QUERY` on PostgreSQL, put `resourceFilterCondition` and the rule `joins` into the query, select `visibilitySelect`, and call `applyVisibility` after the shaper. The shape of `compileRule` and `compileFieldRules` results is the contract. Replace the temporary test helpers `test/contract/resource-store.ts` and `test/contract/access-store.ts` (they hold every engine branch and database call of the Part 7 contract specs) with `COLLECTION_QUERY` and `BUCKET_QUERY` calls, and delete them.
- **Part 9:** write rules are still evaluated in memory by `run`, with related records loaded. When `BUCKET_WRITE` is bound on PostgreSQL, `access-store.ts` writes its documents through it, and its PostgreSQL row writer goes.
- **Part 10:** realtime still renders the neutral filter through MongoDB code and runs field rules with `{auth}` only (so `document.*` in a field rule hides the field for every record there). Both are unchanged.

### Tests

- `test/access/` in `data/postgresql`: unit specs of the resource filter, the rule compiler, the functions, relations, field rules and the validator, which check the SQL and the values; and four `*.database.spec.ts` that run rules against rows in a real PostgreSQL. A group of tests declares its documents right above its tests, and the documents are written with `PostgresAccessStore` (`test/contract/access-store.ts`) instead of SQL.
- `test/contract/resource-filter.spec.ts` and `test/contract/access-rules.spec.ts` run on both engines. The second runs about two dozen rules (taken from the existing specs and the admin panel, plus the functions) and requires both engines to select the same rows. The engine branches and database calls of both specs are in two temporary helpers next to them, `resource-store.ts` and `access-store.ts`, so the specs themselves name no engine.
- `data/mongodb` has characterization tests for the resource filter renderer and the validator.
