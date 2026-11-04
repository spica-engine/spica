import {Inject, Injectable, Logger} from "@nestjs/common";
import {DatabaseException, decryptDocumentFields} from "@spica-server/bucket-common";
import {Orm, quote, Session} from "@spica-server/data-postgresql-orm";
import {Bucket} from "@spica-server/interface-bucket";
import {
  BucketQueryFacade,
  BucketReadContext,
  BucketReadResult,
  BucketReadSpec
} from "@spica-server/interface-bucket-common";
import {Page, RESULT_SHAPER, ResultShaper} from "@spica-server/interface-data";
import {applyVisibility, visibilitySelect} from "../../access/index.js";
import {ORM} from "../../orm.js";
import {loadRowSets} from "./children.js";
import {planRead, ReadPlan, TABLE} from "./plan.js";
import {projectDocument} from "./project.js";
import {orderBy} from "./sort.js";
import {countTotal} from "./totals.js";

type Row = Record<string, unknown>;

const READ_TIMEOUT_MS = 30_000;
const QUERY_CANCELED = "57014";

const logger = new Logger("PostgresBucketQueryFacade");

function databaseError(error: unknown): never {
  if (error instanceof Error && "status" in error) {
    throw error;
  }
  logger.error((error as Error)?.message);
  throw new DatabaseException(
    (error as {code?: string})?.code == QUERY_CANCELED
      ? "The query took too long."
      : "The query could not be completed."
  );
}

@Injectable()
export class PostgresBucketQueryFacade implements BucketQueryFacade {
  constructor(
    @Inject(ORM) private readonly orm: Orm,
    @Inject(RESULT_SHAPER) private readonly shaper: ResultShaper
  ) {}

  async find<T>(
    bucket: Bucket,
    spec: BucketReadSpec,
    context: BucketReadContext
  ): Promise<BucketReadResult<T[]>> {
    const plan = await planRead(bucket, spec, context);
    if (plan.matchesNothing) {
      return {result: []};
    }
    const rows = await this.read(plan, spec, session => this.rows(session, plan, spec));
    return {result: await this.documents<T>(bucket, plan, spec, context, rows)};
  }

  async findOne<T>(
    bucket: Bucket,
    spec: BucketReadSpec,
    context: BucketReadContext
  ): Promise<BucketReadResult<T | undefined>> {
    const {result, locale} = await this.find<T>(bucket, spec, context);
    return {result: result[0], locale};
  }

  async paginate<T>(
    bucket: Bucket,
    spec: BucketReadSpec,
    context: BucketReadContext
  ): Promise<BucketReadResult<Page<T>>> {
    const plan = await planRead(bucket, spec, context);
    if (plan.matchesNothing) {
      return {result: {meta: {total: 0}, data: []}};
    }
    const {rows, total} = await this.read(plan, spec, async session => ({
      rows: await this.rows(session, plan, spec),
      total: await countTotal(session, plan)
    }));
    const data = await this.documents<T>(bucket, plan, spec, context, rows);
    return {result: {meta: {total}, data}};
  }

  private async read<R>(
    plan: ReadPlan,
    spec: BucketReadSpec,
    work: (session: Session) => Promise<R>
  ): Promise<R> {
    try {
      return await this.orm.transaction(async session => {
        await session.raw("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
        await session.raw("SELECT set_config('statement_timeout', $1, true)", [
          String(READ_TIMEOUT_MS)
        ]);
        return work(session);
      });
    } catch (error) {
      return databaseError(error);
    }
  }

  private async rows(
    session: Session,
    plan: ReadPlan,
    spec: BucketReadSpec
  ): Promise<{rows: Row[]; rowSets: Awaited<ReturnType<typeof loadRowSets>>}> {
    const {metadata, values, conditions, fieldRules} = plan;
    const joins = [...new Set([...plan.joins, ...(fieldRules?.joins ?? [])])];
    const flags = fieldRules ? visibilitySelect(fieldRules).map(flag => `, ${flag}`) : [];
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const paging: string[] = [];
    if (Number(spec.limit) > 0) {
      values.push(Number(spec.limit));
      paging.push(`LIMIT $${values.length}`);
    }
    if (Number(spec.skip) > 0) {
      values.push(Number(spec.skip));
      paging.push(`OFFSET $${values.length}`);
    }

    const {rows} = await session.raw(
      `SELECT ${quote(TABLE)}.*${flags.join("")} FROM ${quote(metadata.main.name)} AS ${quote(TABLE)} ${joins.join(" ")} ${where} ORDER BY ${orderBy(metadata, spec.sort)} ${paging.join(" ")}`,
      values
    );

    const requested = new Set((spec.projectMap ?? []).map(path => path[0]));
    const hidden = new Set(fieldRules?.hidden ?? []);
    const rowSets = await loadRowSets(
      session,
      metadata,
      rows,
      root => hidden.has(root) || (requested.size > 0 && !requested.has(root))
    );
    return {rows, rowSets};
  }

  private async documents<T>(
    bucket: Bucket,
    plan: ReadPlan,
    spec: BucketReadSpec,
    context: BucketReadContext,
    {rows, rowSets}: {rows: Row[]; rowSets: Awaited<ReturnType<typeof loadRowSets>>}
  ): Promise<T[]> {
    const shaped = await this.shaper.shape<unknown, Record<string, unknown>[]>(
      {kind: "bucket", bucketId: plan.bucketId},
      rowSets
    );
    return shaped.map((document, index) => {
      let result = plan.fieldRules
        ? applyVisibility(document, rows[index], plan.fieldRules)
        : document;
      result = projectDocument(result, spec.projectMap ?? [], plan.metadata.primaryKey.field);
      return (
        context.encryptionSecret
          ? decryptDocumentFields(result, bucket, context.encryptionSecret, context.resolveSchema)
          : result
      ) as T;
    });
  }
}
