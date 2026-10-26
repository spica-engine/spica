import {ObjectId} from "@spica-server/database";
import {IPipelineBuilder, PaginationPlan} from "@spica-server/interface-database";
import {
  FilterReplaceManager,
  FilterReplacer,
  replaceFilterDates,
  replaceFilterObjectIds
} from "@spica-server/filter";

export class PipelineBuilder implements IPipelineBuilder {
  protected pipeline: object[] = [];
  protected isFilterApplied = false;

  constructor(
    private readonly filterReplacers: FilterReplacer[] = [
      replaceFilterObjectIds,
      replaceFilterDates
    ]
  ) {}

  attachToPipeline(condition: unknown, ...attachedObject: object[]) {
    if (!!condition) {
      this.pipeline.push(...attachedObject);
    }
    return this;
  }

  findOneIfRequested(entryId: ObjectId): this {
    this.attachToPipeline(entryId, {$match: {_id: entryId}});
    return this;
  }

  filterResources(resourceFilter: object): this {
    this.attachToPipeline(this.isValidObject(resourceFilter), resourceFilter);
    return this;
  }

  async filterByUserRequest(filter: object) {
    this.isFilterApplied = this.isValidObject(filter);

    if (this.isFilterApplied) {
      const filterReplacer = new FilterReplaceManager(this.filterReplacers);
      filter = await filterReplacer.replace(filter);
    }

    this.attachToPipeline(this.isFilterApplied, {$match: filter});
    return Promise.resolve(this);
  }

  setVisibilityOfFields(fields: {[field: string]: 0 | 1}) {
    this.attachToPipeline(this.isValidObject(fields), {$project: fields});
    return this;
  }

  protected isValidObject(obj) {
    return typeof obj == "object" && !Array.isArray(obj) && !!Object.keys(obj).length;
  }

  sort(sort: object = {}): this {
    this.attachToPipeline(Object.keys(sort).length, {$sort: sort});
    return this;
  }

  limit(limit: number): this {
    this.attachToPipeline(limit, {$limit: limit});
    return this;
  }

  skip(skip: number): this {
    this.attachToPipeline(skip, {$skip: skip});
    return this;
  }

  protected isTotalDocumentCountAffected(): boolean {
    return this.isFilterApplied;
  }

  buildPaginationPlan(
    seekingPipeline: object[],
    estimateTotalDocumentCount: () => Promise<number>
  ): PaginationPlan {
    return {
      dataPipeline: [...this.pipeline, ...seekingPipeline],
      countPipeline: this.isTotalDocumentCountAffected()
        ? [...this.pipeline, {$count: "total"}]
        : null,
      estimateTotalDocumentCount
    };
  }

  result() {
    return this.pipeline;
  }
}
