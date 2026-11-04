import {Inject, Injectable, Logger} from "@nestjs/common";
import {DatabaseException, decryptDocumentFields} from "@spica-server/bucket-common";
import {Orm} from "@spica-server/data-postgresql-orm";
import {Bucket} from "@spica-server/interface-bucket";
import {
  BucketQueryFacade,
  BucketReadContext,
  BucketReadResult,
  BucketReadSpec
} from "@spica-server/interface-bucket-common";
import {Page, RESULT_SHAPER, ResultShaper} from "@spica-server/interface-data";
import {applyVisibility} from "../../access/index.js";
import {ORM} from "../../orm.js";
import {loadRowSets} from "./children.js";
import {planRead, ReadPlan} from "./plan.js";
import {projectDocument} from "./project.js";
import {BucketReads} from "./reads.js";
import {buildRelationTree, describer, RelationNode, resolveRelations} from "./relations.js";
import {orderBy} from "./sort.js";
import {countTotal} from "./totals.js";

type Row = Record<string, unknown>;

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
      return {result: [], locale: plan.locale};
    }
    const tree = await this.relations(bucket, plan, spec, context);
    const rows = await this.read(reads => this.rows(reads, plan, spec, tree));
    return {
      result: await this.documents<T>(bucket, plan, spec, context, rows),
      locale: plan.locale
    };
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
      return {result: {meta: {total: 0}, data: []}, locale: plan.locale};
    }
    const tree = await this.relations(bucket, plan, spec, context);
    const {rows, total} = await this.read(async reads => ({
      rows: await this.rows(reads, plan, spec, tree),
      total: await countTotal(reads, plan)
    }));
    const data = await this.documents<T>(bucket, plan, spec, context, rows);
    return {result: {meta: {total}, data}, locale: plan.locale};
  }

  private relations(
    bucket: Bucket,
    plan: ReadPlan,
    spec: BucketReadSpec,
    context: BucketReadContext
  ) {
    return buildRelationTree(bucket, plan.metadata, spec.relationPaths ?? [], describer(context));
  }

  private async read<R>(work: (reads: BucketReads) => Promise<R>): Promise<R> {
    try {
      return await this.orm.transaction(async session => {
        const reads = new BucketReads(session);
        await reads.restrictToReading();
        return work(reads);
      });
    } catch (error) {
      return databaseError(error);
    }
  }

  private async rows(
    reads: BucketReads,
    plan: ReadPlan,
    spec: BucketReadSpec,
    tree: RelationNode
  ): Promise<{rows: Row[]; rowSets: Awaited<ReturnType<typeof loadRowSets>>}> {
    const rows = await reads.page(plan, orderBy(plan.metadata, spec.sort, plan.locale), spec);

    const requested = new Set((spec.projectMap ?? []).map(path => path[0]));
    const hidden = new Set(plan.fieldRules?.hidden ?? []);
    const skip = (root: string) => hidden.has(root) || (requested.size > 0 && !requested.has(root));
    const rowSets = await loadRowSets(reads, plan.metadata, rows, skip);
    await resolveRelations(reads, tree, rowSets, skip);
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
      rowSets,
      {locale: plan.locale}
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
