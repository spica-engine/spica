// `bson`, not `mongodb` — the rationale is in `realtime.ts` (D28).
import {ObjectId} from "bson";

export interface PaginationPlan {
  dataPipeline: object[];
  countPipeline: object[] | null;
  estimateTotalDocumentCount: () => Promise<number>;
}

export interface PaginationResult<T> {
  meta: {total: number};
  data: T[];
}

export interface AggregatableCollection {
  aggregate<T>(pipeline: object[]): {
    toArray(): Promise<T[]>;
    next(): Promise<T | null>;
  };
}

export interface IPipelineBuilder {
  attachToPipeline(condition: any, ...attachedObject: object[]): this;
  findOneIfRequested(entryId: ObjectId): this;
  filterResources(resourceFilter: object): this;
  filterByUserRequest(filterByUserRequest: object): Promise<this>;
  sort(sort: Object): this;
  limit(limit: number): this;
  skip(skip: number): this;
  buildPaginationPlan(
    seekingPipeline: object[],
    estimateTotalDocumentCount: () => Promise<number>
  ): PaginationPlan;
  result(): object[];
}
