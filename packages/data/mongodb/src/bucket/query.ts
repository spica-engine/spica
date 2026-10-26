import {Inject, Injectable} from "@nestjs/common";
import * as expression from "@spica-server/bucket-expression";
import {
  ACLSyntaxException,
  buildExpressionReplacers,
  categorizePropertyMap,
  DatabaseException,
  decryptDocumentFields,
  resetNonOverlappingPathsInRelationMap
} from "@spica-server/bucket-common";
import {DatabaseService} from "@spica-server/database";
import {executePaginationPlan, PipelineBuilder} from "@spica-server/database-pipeline";
import {Bucket} from "@spica-server/interface-bucket";
import {
  BucketQueryFacade,
  BucketReadContext,
  BucketReadResult,
  BucketReadSpec,
  Locale,
  RelationMap
} from "@spica-server/interface-bucket-common";
import {Page, RESULT_SHAPER, ResultShaper} from "@spica-server/interface-data";
import {PaginationPlan} from "@spica-server/interface-database";
import {aggregatable, AGGREGATE_OPTIONS} from "../aggregate.js";
import {BucketPipelineBuilder} from "./pipeline.builder.js";

interface BucketReadPlan {
  plan: PaginationPlan;
  locale?: Locale;
}

@Injectable()
export class MongoBucketQueryFacade implements BucketQueryFacade {
  constructor(
    private readonly db: DatabaseService,
    @Inject(RESULT_SHAPER) private readonly shaper: ResultShaper
  ) {}

  async find<T>(
    bucket: Bucket,
    spec: BucketReadSpec,
    context: BucketReadContext
  ): Promise<BucketReadResult<T[]>> {
    const {plan, locale} = await this.plan(bucket, spec, context);
    const documents = await this.collection(bucket)
      .aggregate<T>(plan.dataPipeline, AGGREGATE_OPTIONS)
      .toArray()
      .catch(error => {
        throw new DatabaseException(error.message);
      });
    return {result: this.shape(bucket, this.decrypt(bucket, documents, context)), locale};
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
    const {plan, locale} = await this.plan(bucket, spec, context);
    const page = await executePaginationPlan<T>(aggregatable(this.collection(bucket)), plan).catch(
      error => {
        throw new DatabaseException(error.message);
      }
    );
    page.data = this.decrypt(bucket, page.data, context);
    return {result: this.shape(bucket, page), locale};
  }

  private collection(bucket: Bucket) {
    return this.db.collection(`bucket_${bucket._id}`);
  }

  private decrypt<T>(bucket: Bucket, documents: T[], context: BucketReadContext): T[] {
    if (!context.encryptionSecret) {
      return documents;
    }
    return documents.map(document =>
      decryptDocumentFields(
        document as any,
        bucket,
        context.encryptionSecret,
        context.resolveSchema
      )
    ) as T[];
  }

  private shape<R>(bucket: Bucket, result: R): R {
    return this.shaper.shape({kind: "bucket", bucketId: bucket._id.toString()}, result);
  }

  private async plan(
    bucket: Bucket,
    spec: BucketReadSpec,
    context: BucketReadContext
  ): Promise<BucketReadPlan> {
    const pipelineBuilder = new BucketPipelineBuilder(bucket, context);
    const seekingPipelineBuilder = new PipelineBuilder();

    let rulePropertyMap: string[][];
    let ruleRelationMap: RelationMap[];
    let filtersAppliedPipeline: BucketPipelineBuilder;
    let locale: Locale;

    let basePipeline = await pipelineBuilder
      .findOneIfRequested(spec.documentId)
      .filterResources(spec.resourceFilter);

    basePipeline = await basePipeline.localize(spec.localize, spec.language, resolved => {
      locale = resolved;
    });

    if (spec.applyAcl) {
      const rulesAppliedPipeline = await basePipeline
        .rules(spec.user, (propertyMap, relationMap) => {
          rulePropertyMap = propertyMap;
          ruleRelationMap = relationMap;
        })
        .catch(error => {
          throw new ACLSyntaxException(error.message);
        });

      const ruleResetStage = resetNonOverlappingPathsInRelationMap({
        left: [],
        right: rulePropertyMap,
        map: ruleRelationMap
      });
      filtersAppliedPipeline = await rulesAppliedPipeline
        .attachToPipeline(!!ruleResetStage, ruleResetStage)
        .filterByUserRequest(spec.filter);
    } else {
      filtersAppliedPipeline = await basePipeline.filterByUserRequest(spec.filter);
    }

    const seekingPipeline = seekingPipelineBuilder
      .sort(spec.sort)
      .skip(spec.skip)
      .limit(spec.limit);

    const relationPathResolvedPipeline = await filtersAppliedPipeline.resolveRelationPath(
      spec.relationPaths || [],
      relationStage => {
        seekingPipeline.attachToPipeline(true, ...relationStage);
      }
    );

    if (spec.applyAcl) {
      const aclProjection = await buildAclProjection(bucket, spec.user, context);
      seekingPipelineBuilder.attachToPipeline(true, {$project: aclProjection});
    }

    seekingPipeline.setVisibilityOfFields(getVisibilityOfFields(spec.projectMap || []));

    const plan = relationPathResolvedPipeline.buildPaginationPlan(seekingPipeline.result(), () =>
      this.collection(bucket).estimatedDocumentCount()
    );
    return {plan, locale};
  }
}

async function buildAclProjection(bucket: Bucket, user: unknown, context: BucketReadContext) {
  const properties = bucket.properties as Record<string, {acl?: string}>;
  const result: Record<string, object | number> = {};

  const allPropertyMaps: string[][] = [];
  for (const key in properties) {
    const acl = properties[key].acl;
    if (acl) {
      const propMap = expression.extractPropertyMap(acl);
      const {documentPropertyMap} = categorizePropertyMap(propMap);
      allPropertyMaps.push(...documentPropertyMap);
    }
  }

  const replacers = allPropertyMaps.length
    ? await buildExpressionReplacers(
        bucket,
        allPropertyMaps,
        context.resolveSchema,
        context.hashSecret
      )
    : [];

  for (const key in properties) {
    const acl = properties[key].acl;

    if (acl) {
      const condition = expression.aggregateWithReplacers(acl, {auth: user}, "project", replacers);

      result[key] = {
        $cond: {
          if: condition,
          then: "$" + key,
          else: "$$REMOVE"
        }
      };
    } else {
      result[key] = 1;
    }
  }

  return result;
}

function getVisibilityOfFields(fieldMap: string[][]) {
  const result = {};
  for (const fields of fieldMap) {
    result[fields.join(".")] = 1;
  }
  return result;
}
