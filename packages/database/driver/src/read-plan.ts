import {Expression} from "./expression.js";
import {SortSpec} from "./filter.js";

/**
 * The neutral read plan: it describes **what is wanted**, and **how** is the driver's decision — an
 * aggregation pipeline on Mongo, a single `SELECT` with `LATERAL`/`COALESCE` on PostgreSQL.
 */
export interface ReadPlan {
  collection: string;

  /** Multi-language resolution; without it the fields come back raw (as a language map). */
  localize?: LocalizeSpec;

  /** The condition compiled from the bucket's ACL rule (K-11: a `WHERE`/`$match`, not RLS). */
  acl?: Expression;

  /** The user's `?filter=` expression. */
  filter?: Expression;

  relations?: RelationResolution[];

  projection?: ProjectionSpec;

  sort?: SortSpec;
  skip?: number;
  limit?: number;

  /**
   * When `true` the driver returns the total count too. **How** is left to the driver: a single statement with
   * `count(*) OVER ()` measured slower than a second parallel query.
   */
  paginate?: boolean;

  /**
   * The requesting identity, from which an ACL expression's `auth.*` chain resolves. It belongs to the plan
   * rather than to the driver: a collection object is shared between requests while the identity is not.
   */
  auth?: Record<string, any>;
}

/**
 * Where a stage is applied — the single field that decides the cost.
 *
 * `filter` has to run **before** the filter, because the filter or the ACL references this field.
 * `projection` runs **after** the `limit`, so it only touches the returned rows. Applied before the filter
 * instead, a stage runs over every document and disables the index — two orders of magnitude, measured.
 */
export type Stage = "filter" | "projection";

export interface LocalizeSpec {
  /** The requested language (resolved from `accept-language`). */
  locale: string;
  /** The default language from the bucket's preferences. */
  fallback: string;
  /** The fields with `options.translate = true`. */
  properties: string[];
  stage: Stage;
}

export type RelationType = "one" | "many";

export interface RelationResolution {
  /** The field path in the document. */
  path: string;
  /** The target collection. */
  target: string;
  type: RelationType;
  stage: Stage;
  /** Nested relations. */
  children?: RelationResolution[];
}

export interface ProjectionSpec {
  include?: string[];
  exclude?: string[];
  /** The fields closed to the user **unconditionally**, coming from field-level ACL. */
  denied?: string[];
  /**
   * The conditional form of field-level ACL (the second step of AK-10).
   *
   * `denied` is a **static** list and cannot express `properties[x].acl`: that rule is evaluated per
   * document — within the same read a field is visible on one row and not on another. So the plan
   * carries the condition **itself**, not its result; which field drops out on which row is computed by
   * the driver.
   *
   * When the condition is false the field is **removed** from the document rather than turned into
   * `null`: its counterpart on the Mongo side is
   * `{$cond: {if: …, then: "$field", else: "$$REMOVE"}}`, and the contract requires both legs to give
   * the same document.
   */
  conditional?: ConditionalProjection[];
}

/** A field's per-document visibility condition. */
export interface ConditionalProjection {
  path: string;
  when: Expression;
}

export interface ReadResult<T> {
  data: T[];
  /** Filled when `paginate: true`. */
  total?: number;
}
