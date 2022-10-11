import * as expression from "@spica-server/bucket/expression";
import {ObjectId} from "@spica-server/database";
import {Bucket} from "@spica-server/bucket/services";
import {CrudFactories} from "./crud";
import {buildI18nAggregation, findLocale, hasTranslatedProperties, Locale} from "./locale";
import {deepCopy} from "@spica-server/core/patch";
import {
  compareAndUpdateRelations,
  createRelationMap,
  getRelationPipeline,
  RelationMap
} from "./relation";
import {extractFilterPropertyMap, replaceFilterObjectIds} from "@spica-server/bucket/services";

export interface iPipelineBuilder {
  attachToPipeline(condition: any, ...attachedObject: object[]): this;
  findOneIfRequested(entryId: ObjectId): this;
  filterResources(resourceFilter: object): this;
  filterScheduledData(isScheduled: boolean): this;
  localize(
    isLocalizationRequested: boolean,
    language: string,
    callback?: (locale: Locale) => void
  ): Promise<this>;
  rules(userId: string, callback?: (arg0: string[][], arg1: RelationMap[]) => void): Promise<this>;
  filterByUserRequest(filterByUserRequest: string | object): Promise<this>;
  resolveRelationPath(
    relationPaths: string[][],
    callback?: (relationStage: object[]) => void
  ): Promise<this>;
  sort(sort: Object): this;
  limit(limit: number): this;
  skip(skip: number): this;
  paginate(
    paginate: boolean,
    seekingPipeline: object[],
    totalDocumentCount: Promise<number>
  ): Promise<this>;
  result(): object[];
}

export class PipelineBuilder implements iPipelineBuilder {
  private isFilterApplied: boolean;
  private pipeline: object[] = [];
  private schema: Bucket;
  private factories: CrudFactories<any>;
  private usedRelationPaths: string[] = [];
  private locale: Locale;

  constructor(schema: Bucket, factories: CrudFactories<any>) {
    this.schema = schema;
    this.factories = factories;
  }

  private buildRelationMap(propertyMap: string[][]): Promise<RelationMap[]> {
    return createRelationMap({
      paths: propertyMap,
      properties: this.schema.properties,
      resolve: this.factories.schema
    });
  }

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
    this.attachToPipeline(resourceFilter, resourceFilter);
    return this;
  }
  filterScheduledData(isScheduled: boolean): this {
    this.attachToPipeline(true, {$match: {_schedule: {$exists: isScheduled}}});
    return this;
  }
  async localize(
    isLocalizationRequested: boolean,
    language: string,
    callBack: (value: Locale) => void
  ): Promise<this> {
    if (isLocalizationRequested && hasTranslatedProperties(this.schema)) {
      this.locale = findLocale(language, await this.factories.preference());
      this.pipeline.push({
        $replaceWith: buildI18nAggregation("$$ROOT", this.locale.best, this.locale.fallback)
      });
      callBack(this.locale);
    }
    return this;
  }
  async rules(
    userId: string,
    callback?: (arg0: string[][], arg1: RelationMap[]) => void
  ): Promise<this> {
    const rulePropertyMap = expression
      .extractPropertyMap(this.schema.acl.read)
      .map(path => path.split("."));

    const ruleRelationMap = await this.buildRelationMap(rulePropertyMap);
    const ruleRelationStage = getRelationPipeline(ruleRelationMap, this.locale);
    const ruleExpression = expression.aggregate(this.schema.acl.read, {auth: userId});

    this.attachToPipeline(true, ...ruleRelationStage);
    this.attachToPipeline(true, {$match: ruleExpression});

    callback(rulePropertyMap, ruleRelationMap);
    return this;
  }

  async filterByUserRequest(filterByUserRequest: string | object): Promise<this> {
    let filterPropertyMap: string[][] = [];
    let filterRelationMap: object[] = [];
    // filter
    if (filterByUserRequest) {
      let filterExpression: object;

      if (
        typeof filterByUserRequest == "object" &&
        !Array.isArray(filterByUserRequest) &&
        Object.keys(filterByUserRequest).length
      ) {
        filterByUserRequest = replaceFilterObjectIds(filterByUserRequest);
        filterPropertyMap = extractFilterPropertyMap(filterByUserRequest);
        filterExpression = filterByUserRequest;
      } else if (typeof filterByUserRequest == "string") {
        filterPropertyMap = expression
          .extractPropertyMap(filterByUserRequest)
          .map(path => path.split("."));
        filterExpression = expression.aggregate(filterByUserRequest, {});
      }

      filterRelationMap = await this.buildRelationMap(filterPropertyMap);
      const updatedFilterRelationMap = compareAndUpdateRelations(
        deepCopy(filterRelationMap),
        this.usedRelationPaths
      );
      const filterRelationStage = getRelationPipeline(updatedFilterRelationMap, this.locale);

      this.attachToPipeline(true, ...filterRelationStage);
      this.attachToPipeline(filterExpression, {$match: filterExpression});

      this.isFilterApplied = true;
    }
    return this;
  }

  async resolveRelationPath(
    relationPaths: string[][],
    callback?: (relationStage: object[]) => void
  ): Promise<this> {
    const relationPropertyMap = relationPaths || [];
    let relationMap = [];
    if (relationPropertyMap.length) {
      relationMap = await this.buildRelationMap(relationPaths);
      const updatedRelationMap = compareAndUpdateRelations(
        deepCopy(relationMap),
        this.usedRelationPaths
      );
      const relationStage = getRelationPipeline(updatedRelationMap, this.locale);
      callback(relationStage);
    }
    return this;
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
    totalDocumentCount: Promise<number>
  ): Promise<this> {
    let meta;

    if (paginate) {
      const filteredsLength = [{$count: "total"}];

      const totalLength = [
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

      meta = this.isFilterApplied ? filteredsLength : totalLength;

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

  result(): object[] {
    return this.pipeline;
  }
}
