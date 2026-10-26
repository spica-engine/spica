# Part 7: Access control

## How to use this document

- Plan and implement only this part. Read the code from the parts under "Depends on" on master, along with their "As built" sections. Don't open the other documents in `docs/postgresql/`.
- If this part needs something a merged part doesn't provide, stop and list it under "Requests to other parts" in your plan instead of building it.
- Follow the PR breakdown. Each PR is either a behaviour-neutral refactor or new engine code, never both, and is small enough to review in one sitting.
- Existing MongoDB suites stay green. New code brings its own tests in the PostgreSQL CI job.
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

_Fill in after the last PR merges._
