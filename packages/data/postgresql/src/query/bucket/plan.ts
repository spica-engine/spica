import {BadRequestException} from "@nestjs/common";
import {ACLSyntaxException} from "@spica-server/bucket-common";
import {assertFilterLanguage} from "@spica-server/data";
import {bind, quote, ResolvedColumn} from "@spica-server/data-postgresql-orm";
import {Bucket} from "@spica-server/interface-bucket";
import {BucketReadContext, BucketReadSpec} from "@spica-server/interface-bucket-common";
import {
  CompiledFieldRules,
  compileFieldRules,
  compileFilter,
  compileRule,
  keyParser,
  loadRelatedBuckets,
  resourceFilterCondition,
  RuleCompileError
} from "../../access/index.js";
import {BucketMetadata, describeBucket, resolveRelationTargets} from "../../schema/index.js";

export const TABLE = "t";

export const tableColumn = (column: string) => `${quote(TABLE)}.${quote(column)}`;

const parenthesized = (sql: string) => `(${sql})`;

export interface ReadPlan {
  bucketId: string;
  metadata: BucketMetadata;
  values: unknown[];
  conditions: string[];
  joins: string[];
  fieldRules?: CompiledFieldRules;
  matchesNothing: boolean;
  conditionValues: number;
}

const unique = (joins: Iterable<string>) => [...new Set(joins)];

const isReadable = (rule: unknown): rule is string => typeof rule == "string" && !!rule.trim();

async function find(context: BucketReadContext, id: string) {
  try {
    return await context.resolveSchema(id);
  } catch {
    return undefined;
  }
}

function userFilterOf(filter: BucketReadSpec["filter"]) {
  assertFilterLanguage(filter, ["expression"], "PostgreSQL");
  return typeof filter == "string" && filter.trim() ? filter : undefined;
}

function rulesOf(bucket: Bucket, spec: BucketReadSpec, filter?: string): string[] {
  const properties = (bucket.properties ?? {}) as Record<string, {acl?: string}>;
  return [
    filter,
    ...(spec.applyAcl ? [bucket.acl?.read, ...Object.values(properties).map(p => p.acl)] : [])
  ].filter(isReadable);
}

export async function planRead(
  bucket: Bucket,
  spec: BucketReadSpec,
  context: BucketReadContext
): Promise<ReadPlan> {
  const filter = userFilterOf(spec.filter);
  const bucketId = String(bucket._id);
  const lookup = (id: string) => find(context, id);
  const metadata = describeBucket(bucketId, bucket, await resolveRelationTargets(bucket, lookup));
  const related = await loadRelatedBuckets(
    {bucket, metadata, bucketId},
    rulesOf(bucket, spec, filter),
    lookup
  );

  const values: unknown[] = [];
  const conditions: string[] = [];
  const joins = new Set<string>();
  let matchesNothing = false;
  const key = metadata.primaryKey;
  const keyColumn = tableColumn(key.column);
  const keyEquals = (id: string) => `${keyColumn} = ${bind(values, parseKey(id))}::${key.type}`;
  const parseKey = keyParser(key.type);
  const scope = {
    bucket,
    metadata,
    hashSecret: context.hashSecret,
    table: TABLE,
    related
  };

  const add = (compiled: {sql: string; joins: string[]; constant?: boolean}) => {
    if (compiled.constant === false) {
      matchesNothing = true;
    } else if (compiled.constant === undefined) {
      conditions.push(parenthesized(compiled.sql));
      compiled.joins.forEach(join => joins.add(join));
    }
  };

  if (spec.documentId !== undefined) {
    conditions.push(keyEquals(String(spec.documentId)));
  }

  const resourceFilter = spec.resourceFilter;
  if (resourceFilter?.include?.length || resourceFilter?.exclude?.length) {
    conditions.push(
      resourceFilterCondition(resourceFilter, parseKey).sql(
        keyColumn,
        {type: key.type} as ResolvedColumn,
        values
      )
    );
  }

  if (spec.applyAcl && isReadable(bucket.acl?.read)) {
    try {
      add(compileRule(bucket.acl.read, {...scope, auth: spec.user}, values));
    } catch (error) {
      throw error instanceof RuleCompileError ? new ACLSyntaxException(error.message) : error;
    }
  }

  if (filter) {
    try {
      add(compileFilter(filter, scope, values));
    } catch (error) {
      throw error instanceof RuleCompileError ? new BadRequestException(error.message) : error;
    }
  }

  const conditionValues = values.length;
  const fieldRules = spec.applyAcl
    ? compileFieldRules({...scope, auth: spec.user}, values)
    : undefined;

  return {
    bucketId,
    metadata,
    values,
    conditions,
    joins: unique(joins),
    fieldRules,
    matchesNothing,
    conditionValues
  };
}
