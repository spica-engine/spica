import {Inject, Injectable} from "@nestjs/common";
import {DatabaseService} from "@spica-server/database";
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
  ResultShaper
} from "@spica-server/interface-data";
import {PaginationPlan} from "@spica-server/interface-database";

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
      .aggregate<T>(plan.dataPipeline)
      .toArray();
    return this.shape(collection, documents);
  }

  async findOne<T>(collection: string, spec: ReadSpec): Promise<T | null> {
    const plan = await this.plan(collection, spec);
    const document = await this.db.collection(collection).aggregate<T>(plan.dataPipeline).next();
    return this.shape(collection, document);
  }

  async paginate<T>(collection: string, spec: ReadSpec, count: CountStrategy): Promise<Page<T>> {
    const page =
      count == "exact"
        ? await this.exactPage<T>(collection, spec)
        : await executePaginationPlan<T>(
            this.db.collection(collection),
            await this.plan(collection, spec)
          );
    return this.shape(collection, page);
  }

  private async base(collection: string, spec: ReadSpec) {
    const replaceIds = (filter: object) =>
      replaceFilterObjectIds(filter, this.idTypes.forCollection(collection));
    const builder = new PipelineBuilder([
      ...(spec.filterReplacers || []),
      replaceIds,
      replaceFilterDates
    ])
      .findOneIfRequested(spec.id)
      .filterResources(spec.resourceFilter);
    return builder.filterByUserRequest(spec.filter);
  }

  private async plan(collection: string, spec: ReadSpec): Promise<PaginationPlan> {
    const base = await this.base(collection, spec);
    const seeking = new PipelineBuilder()
      .sort(spec.sort)
      .skip(spec.skip)
      .limit(spec.limit)
      .setVisibilityOfFields(spec.fields)
      .result();
    return base.buildPaginationPlan(seeking, () =>
      this.db.collection(collection).estimatedDocumentCount()
    );
  }

  private async exactPage<T>(collection: string, spec: ReadSpec): Promise<Page<T>> {
    const base = await this.base(collection, spec);
    const data = [
      ...new PipelineBuilder().sort(spec.sort).result(),
      // $facet rejects an empty sub-pipeline, so $skip is always present.
      {$skip: spec.skip || 0},
      ...new PipelineBuilder().limit(spec.limit).setVisibilityOfFields(spec.fields).result()
    ];
    const pipeline = [
      ...base.result(),
      {$facet: {meta: [{$count: "total"}], data}},
      {$set: {meta: {$ifNull: [{$arrayElemAt: ["$meta", 0]}, {$const: {total: 0}}]}}}
    ];
    return this.db.collection(collection).aggregate<Page<T>>(pipeline).next();
  }

  private shape<R>(collection: string, result: R): R {
    return this.shaper.shape({kind: "collection", name: collection}, result);
  }
}
