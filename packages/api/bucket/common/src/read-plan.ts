import {
  ConditionalProjection,
  Expression,
  fromLegacyAst,
  fromMongoFilter,
  ReadPlan,
  RelationResolution
} from "@spica-server/database-driver";
import {Bucket, BucketPreferences} from "@spica-server/interface-bucket";
import {CrudFactories, CrudOptions, CrudParams} from "@spica-server/interface-bucket-common";
import * as expression from "@spica-server/bucket-expression";
import {createRelationMap} from "./relation.js";
import {RelationMap} from "@spica-server/interface-bucket-common";
import {buildExpressionReplacers} from "./expression.filter.js";
import {categorizePropertyMap} from "./helpers.js";
import {constructFilterValues} from "./json.filter.js";
import {extractFilterPropertyMap} from "@spica-server/filter";
import {findLocale} from "./locale.js";
import {getBucketDataCollection} from "@spica-server/bucket-services";

/**
 * The bucket read intent → a neutral `ReadPlan`: the plan says **what** is wanted and compiling it is the
 * driver's job. The PostgreSQL leg compiles it into a `SELECT`; the MongoDB leg stays on its existing
 * pipeline path, which already works.
 *
 * Field-level ACL is carried as `ProjectionSpec.conditional` — the condition itself, evaluated per document,
 * because a field visible on one row of the same read is not visible on another.
 *
 * When no plan can be produced the function returns `undefined` and the caller falls back to the pipeline,
 * rather than producing a plan that would be silently wrong.
 */
export interface ReadPlanContext {
  schema: Bucket;
  params: CrudParams;
  options: CrudOptions<boolean>;
  factories: CrudFactories<unknown>;
  preferences: BucketPreferences;
  hashSecret?: string;
}

export async function buildReadPlan(context: ReadPlanContext): Promise<ReadPlan | undefined> {
  const {schema, params, options} = context;

  const plan: ReadPlan = {collection: getBucketDataCollection(schema._id)};

  /** Reading by id is part of the filter: the constraint is an equality, so `ReadPlan` needs no own field. */
  const userFilter = await userFilterExpression(context);
  const idFilter = params.documentId ? documentIdEquals(params.documentId) : undefined;
  const filter = conjoin(idFilter, userFilter);

  if (filter) {
    plan.filter = filter;
  }

  const acl = await toExpression(context, schema.acl?.read, params.applyAcl);
  if (acl) {
    plan.acl = acl;
  }

  /**
   * `auth.*` in an ACL expression resolves from the requesting identity, so the identity belongs to the plan:
   * a field on the driver could not serve it, because the collection object is shared between requests.
   */
  if (params.req?.user) {
    plan.auth = params.req.user;
  }

  const conditional = await buildFieldAcl(context);
  if (conditional.length) {
    plan.projection = {...plan.projection, conditional};
  }

  const localize = buildLocalize(context);
  if (localize) {
    plan.localize = localize;
  }

  /**
   * Relations resolve in two **stages**: `"filter"` when the filter or the ACL references the relation's field,
   * because the join has to precede the `WHERE`; `"projection"` for display only, where the join happens after
   * the `LIMIT` and runs on the returned rows alone.
   */
  const filterRelationPaths = [
    ...filterRelationPathsOf(params.filter),
    ...(params.applyAcl ? relationPathsIn(schema.acl?.read) : [])
  ];

  const relations = await buildRelations(context, filterRelationPaths, params.relationPaths || []);

  if (relations.length) {
    plan.relations = relations;
  }

  if (params.sort && Object.keys(params.sort).length) {
    plan.sort = params.sort as ReadPlan["sort"];
  }
  /**
   * `0` means **"no limit"**, not "return nothing": that is what the controller passes when none is given, and
   * the pipeline builder omits the stage on a falsy value. The same contract holds for `skip`.
   */
  if (params.skip) {
    plan.skip = params.skip;
  }
  if (params.limit) {
    plan.limit = params.limit;
  }
  if (options.paginate) {
    plan.paginate = true;
  }

  return plan;
}

/** `document._id == "<hex>"` — the CEL counterpart of the id constraint. */
function documentIdEquals(documentId: unknown): Expression {
  return {
    kind: "binary",
    operator: "==",
    left: {
      kind: "select",
      left: {kind: "identifier", name: "document"},
      right: {kind: "identifier", name: "_id"}
    },
    right: {kind: "literal", type: "string", value: String(documentId)}
  };
}

/** Combines two expressions with `&&`; when one is missing it returns the other. */
function conjoin(left?: Expression, right?: Expression): Expression | undefined {
  if (!left) return right;
  if (!right) return left;
  return {kind: "binary", operator: "&&", left, right};
}

/**
 * Field-level ACL → `ProjectionSpec.conditional`. The Mongo counterpart builds the `$cond` itself; here the
 * plan carries the condition raw and the driver decides how to evaluate it.
 *
 * The replacers are built **once** over all the field ACLs: per field would walk the schema per field, and
 * `getRelationResolvedBucketSchema` copies the schema on every call.
 */
async function buildFieldAcl(context: ReadPlanContext): Promise<ConditionalProjection[]> {
  const {schema, params} = context;
  if (!params.applyAcl) {
    return [];
  }

  const properties = (schema.properties || {}) as Record<string, {acl?: string}>;
  const entries = Object.entries(properties).filter(([, property]) => property?.acl);
  if (!entries.length) {
    return [];
  }

  const propertyMaps: string[][] = [];
  for (const [, property] of entries) {
    const {documentPropertyMap} = categorizePropertyMap(
      expression.extractPropertyMap(property.acl!)
    );
    propertyMaps.push(...documentPropertyMap);
  }

  const replacers = propertyMaps.length
    ? await buildExpressionReplacers(
        schema,
        propertyMaps,
        context.factories.schema,
        context.hashSecret
      )
    : [];

  return entries.map(([path, property]) => ({
    path,
    when: fromLegacyAst(expression.astWithReplacers(property.acl!, replacers))
  }));
}

/**
 * The user filter → an `Expression`; both languages come out as the same canonical tree, CEL through
 * `fromLegacyAst` and raw Mongo JSON through `fromMongoFilter`.
 *
 * The JSON branch calls `constructFilterValues` first, as the pipeline path does: without it the schema's
 * `ObjectId`/`Date`/`hash` fields would be compared as strings.
 */
async function userFilterExpression(context: ReadPlanContext): Promise<Expression | undefined> {
  const {schema, params} = context;
  if (!params.filter) {
    return undefined;
  }

  if (typeof params.filter === "string") {
    return toExpression(context, params.filter);
  }

  if (Array.isArray(params.filter) || !Object.keys(params.filter).length) {
    return undefined;
  }

  const constructed = await constructFilterValues(
    params.filter as object,
    schema,
    context.factories.schema,
    context.hashSecret
  );

  return fromMongoFilter(constructed as Record<string, any>);
}

/** The paths of the filter that enter a relation — a different extractor per language, the same result. */
function filterRelationPathsOf(filter: CrudParams["filter"]): string[][] {
  if (!filter) {
    return [];
  }

  if (typeof filter === "string") {
    return relationPathsIn(filter);
  }

  return extractFilterPropertyMap(filter as object).filter(path => path.length > 1);
}

/**
 * A CEL string → the contract's `Expression` tree. The replacers **are** applied: a hashed or encrypted field
 * rewrites the expression, and without it the column would be compared against the raw value.
 */
async function toExpression(
  context: ReadPlanContext,
  source: string | undefined,
  enabled = true
): Promise<Expression | undefined> {
  if (!source || !enabled) {
    return undefined;
  }

  const {documentPropertyMap} = categorizePropertyMap(expression.extractPropertyMap(source));
  const replacers = documentPropertyMap.length
    ? await buildExpressionReplacers(
        context.schema,
        documentPropertyMap,
        context.factories.schema,
        context.hashSecret
      )
    : [];

  return fromLegacyAst(expression.astWithReplacers(source, replacers));
}

/**
 * The localization plan. `stage` is **`projection`**: applied before the filter it runs over every document and
 * disables the index, which is what the Mongo path does unconditionally.
 */
function buildLocalize(context: ReadPlanContext): ReadPlan["localize"] {
  const {schema, params, options, preferences} = context;
  if (!options.localize) {
    return undefined;
  }

  const properties = Object.entries(schema.properties || {})
    .filter(([, property]: [string, any]) => property?.options?.translate)
    .map(([name]) => name);

  if (!properties.length) {
    return undefined;
  }

  const locale = findLocale(params.language, preferences);

  return {
    locale: locale.best,
    fallback: locale.fallback,
    properties,
    stage: "projection"
  };
}

/**
 * The requested relation paths → a **tree** of `RelationResolution[]`, built by `createRelationMap` rather
 * than by hand: it already resolves nested paths, relations embedded in an `object` and the target schemas,
 * and the Mongo path uses the same tree.
 *
 * The filter and projection paths are merged into **one** map: built separately, a relation appearing in both
 * produced two joins. The stage is assigned afterwards.
 */
async function buildRelations(
  context: ReadPlanContext,
  filterPaths: string[][],
  projectionPaths: string[][]
): Promise<RelationResolution[]> {
  const paths = [...filterPaths, ...projectionPaths];
  if (!paths.length) {
    return [];
  }

  const map = await createRelationMap({
    properties: context.schema.properties,
    paths,
    resolve: context.factories.schema
  });

  /**
   * The comparison uses `path + "."`: `meta.author.name` passes **through** the relation while `meta.author`
   * only reads the column. Looking at the first segment is wrong for a relation embedded in an `object`.
   */
  const traversedByFilter = (path: string) =>
    filterPaths.some(segments => segments.join(".").startsWith(`${path}.`));

  return map.map(relation =>
    toResolution(relation, traversedByFilter(relation.path) ? "filter" : "projection")
  );
}

/**
 * `RelationMap` → the contract's `RelationResolution`, recursively. The children inherit the parent's stage,
 * because the compiler merges them inside the parent's lateral.
 */
function toResolution(relation: RelationMap, stage: "filter" | "projection"): RelationResolution {
  return {
    path: relation.path,
    target: getBucketDataCollection(relation.target),
    type: relation.type === "onetomany" ? "many" : "one",
    stage,
    ...(relation.children?.length
      ? {children: relation.children.map(child => toResolution(child, stage))}
      : {})
  };
}

/**
 * The paths where a CEL expression touches a **sub-field**; a reference to the relation itself reads the column
 * and needs no join. Whether a path passes through a relation is `createRelationMap`'s decision, not a second
 * reading of the schema here.
 */
function relationPathsIn(source?: string): string[][] {
  if (!source) {
    return [];
  }

  const {documentPropertyMap} = categorizePropertyMap(expression.extractPropertyMap(source));

  return documentPropertyMap.filter(path => path.length > 1);
}
