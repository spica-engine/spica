import {ObjectId} from "../..";
import {IPipelineBuilder} from "../../../interface/database";

export class PipelineBuilder implements IPipelineBuilder {
  protected pipeline: object[] = [];
  protected isFilterApplied = false;

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
    this.attachToPipeline(this.isFilterApplied, {$match: filter});
    return Promise.resolve(this);
  }

  setVisibilityOfFields(fields: {[field: string]: 0 | 1}) {
    this.attachToPipeline(this.isValidObject(fields), {$project: fields});
    return this;
  }

  private isValidObject(obj) {
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

  async paginate(
    paginate: boolean,
    seekingPipeline: object[],
    totalDocumentCount: Promise<number>,
    isTotalDocumentCountAffected: () => boolean = () => this.isFilterApplied
  ): Promise<this> {
    let meta;

    if (paginate) {
      const filteredsLength = () => [{$count: "total"}];

      const totalLength = async () => [
        {$limit: 1},
        {
          $addFields: {
            total: await totalDocumentCount
          }
        },
        {
          $project: {
            total: 1,
            _id: 0
          }
        }
      ];

      meta = await (isTotalDocumentCountAffected() ? filteredsLength() : totalLength());

      this.pipeline.push(
        {
          $facet: {
            meta,
            data: seekingPipeline.length ? seekingPipeline : [{$unwind: "$_id"}]
          }
        },
        {$unwind: {path: "$meta", preserveNullAndEmptyArrays: true}}
      );
    }
    return this;
  }

  result() {
    return this.pipeline;
  }
}
