import {Inject, Injectable} from "@nestjs/common";
import {DatabaseService, ObjectId} from "@spica-server/database";
import {executePaginationPlan, PipelineBuilder} from "@spica-server/database-pipeline";
import {replaceFilterDates, replaceFilterObjectIds} from "@spica-server/filter";
import {
  CollectionQueryFacade,
  CountStrategy,
  ID_TYPES,
  IdTypes,
  Page,
  ReadSpec,
  RESULT_SHAPER,
  ResultShaper,
  WhereCondition
} from "@spica-server/interface-data";
import {PaginationPlan} from "@spica-server/interface-database";
import {aggregatable, AGGREGATE_OPTIONS} from "../aggregate.js";
import {Relation, RelationPlacement, relationsOf} from "./profiles.js";

class ReadPipelineBuilder extends PipelineBuilder {
  private matched = false;

  match(conditions: object | undefined): this {
    if (conditions) {
      this.pipeline.push({$match: conditions});
      this.matched = true;
    }
    return this;
  }

  protected isTotalDocumentCountAffected(): boolean {
    return super.isTotalDocumentCountAffected() || this.matched;
  }
}

function stagesAt(relations: Relation[], placement: RelationPlacement): object[] {
  return relations.filter(relation => relation.placement == placement).flatMap(r => r.stages);
}

function renderCondition(condition: WhereCondition): unknown {
  if ("in" in condition) {
    return {$in: condition.in};
  }
  if ("matches" in condition) {
    return condition.caseInsensitive
      ? {$regex: condition.matches, $options: "i"}
      : {$regex: condition.matches};
  }
  return condition.eq;
}

function renderConditions(spec: ReadSpec): object | undefined {
  if (!spec.where && !spec.createdBetween) {
    return undefined;
  }
  const conditions: {[field: string]: unknown} = {};
  if (spec.createdBetween) {
    conditions._id = {
      $gte: ObjectId.createFromTime(spec.createdBetween.from.getTime() / 1000),
      $lt: ObjectId.createFromTime(spec.createdBetween.to.getTime() / 1000)
    };
  }
  for (const [field, condition] of Object.entries(spec.where || {})) {
    conditions[field] = renderCondition(condition);
  }
  return conditions;
}

@Injectable()
export class MongoCollectionQueryFacade implements CollectionQueryFacade {
  constructor(
    private readonly db: DatabaseService,
    @Inject(ID_TYPES) private readonly idTypes: IdTypes,
    @Inject(RESULT_SHAPER) private readonly shaper: ResultShaper
  ) {}

  async find<T>(collection: string, spec: ReadSpec = {}): Promise<T[]> {
    const plan = await this.plan(collection, spec);
    const documents = await this.db
      .collection(collection)
      .aggregate<T>(plan.dataPipeline, AGGREGATE_OPTIONS)
      .toArray();
    return this.shape(collection, documents);
  }

  async findOne<T>(collection: string, spec: ReadSpec): Promise<T | null> {
    const plan = await this.plan(collection, spec);
    const document = await this.db
      .collection(collection)
      .aggregate<T>(plan.dataPipeline, AGGREGATE_OPTIONS)
      .next();
    return this.shape(collection, document);
  }

  async paginate<T>(collection: string, spec: ReadSpec, count: CountStrategy): Promise<Page<T>> {
    const page =
      count == "exact"
        ? await this.exactPage<T>(collection, spec)
        : await executePaginationPlan<T>(
            aggregatable(this.db.collection(collection)),
            await this.plan(collection, spec)
          );
    return this.shape(collection, page);
  }

  private async base(collection: string, spec: ReadSpec) {
    const replaceIds = (filter: object) =>
      replaceFilterObjectIds(filter, this.idTypes.forCollection(collection));
    const relations = relationsOf(collection, spec.relations);
    const builder = await new ReadPipelineBuilder([
      ...(spec.filterReplacers || []),
      replaceIds,
      replaceFilterDates
    ])
      .findOneIfRequested(spec.id)
      .filterResources(spec.resourceFilter)
      .attachToPipeline(true, ...stagesAt(relations, "before-filter"))
      .match(renderConditions(spec))
      .filterByUserRequest(spec.filter);
    return builder.attachToPipeline(true, ...stagesAt(relations, "after-filter"));
  }

  private seeking(collection: string, spec: ReadSpec, alwaysSkip = false): object[] {
    const builder = new PipelineBuilder().sort(spec.sort);
    // $facet rejects an empty sub-pipeline, so exact pages always carry $skip.
    if (alwaysSkip) {
      builder.attachToPipeline(true, {$skip: spec.skip || 0});
    } else {
      builder.skip(spec.skip);
    }
    return builder
      .limit(spec.limit)
      .attachToPipeline(true, ...stagesAt(relationsOf(collection, spec.relations), "after-seek"))
      .setVisibilityOfFields(spec.fields)
      .result();
  }

  private async plan(collection: string, spec: ReadSpec): Promise<PaginationPlan> {
    const base = await this.base(collection, spec);
    return base.buildPaginationPlan(this.seeking(collection, spec), () =>
      this.db.collection(collection).estimatedDocumentCount()
    );
  }

  private async exactPage<T>(collection: string, spec: ReadSpec): Promise<Page<T>> {
    const base = await this.base(collection, spec);
    const data = this.seeking(collection, spec, true);
    const pipeline = [
      ...base.result(),
      {$facet: {meta: [{$count: "total"}], data}},
      {$set: {meta: {$ifNull: [{$arrayElemAt: ["$meta", 0]}, {$const: {total: 0}}]}}}
    ];
    return this.db.collection(collection).aggregate<Page<T>>(pipeline, AGGREGATE_OPTIONS).next();
  }

  private shape<R>(collection: string, result: R): R {
    return this.shaper.shape({kind: "collection", name: collection}, result);
  }
}
