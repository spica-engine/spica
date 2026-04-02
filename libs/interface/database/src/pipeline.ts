import {ObjectId} from "mongodb";

export interface IPipelineBuilder {
  attachToPipeline(condition: any, ...attachedObject: object[]): this;
  findOneIfRequested(entryId: ObjectId): this;
  filterResources(resourceFilter: object): this;
  filterByUserRequest(filterByUserRequest: object): Promise<this>;
  sort(sort: Object): this;
  limit(limit: number): this;
  skip(skip: number): this;
  paginate(
    paginate: boolean,
    seekingPipeline: object[],
    totalDocumentCount: Promise<number>,
    isTotalDocumentCountAffected?: () => boolean
  ): Promise<this>;
  result(): object[];
}
