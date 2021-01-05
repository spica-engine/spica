import * as expression from "@spica-server/bucket/expression";
import {ObjectId} from "@spica-server/database";
import {Bucket} from "../services/src/bucket";
import {CrudFactories} from "./crud";
import {buildI18nAggregation, findLocale, hasTranslatedProperties} from "./locale";
import {deepCopy} from "./patch";
import {
  compareAndUpdateRelations,
  createRelationMap,
  getRelationPipeline,
  RelationMap
} from "./relation";

export interface iPipelineBuilder {
  locale;
  attachToPipeline(condition, ...attachedObject: object[]);
  findOneIfRequested(entryId: ObjectId): this;
  filterResources(resourceFilter: object): this;
  filterScheduledData(isScheduled: boolean): this;
  localize(isLocalizationRequested: boolean, language: string, callback?): Promise<this>;
  rules(userId: string, callback?: (arg0: string[][], arg1: RelationMap[]) => any): Promise<this>;
  filterByUserRequest(filterByUserRequest: string | object): Promise<this>;
  resolveRelationPath(
    relationPaths: string[][],
    callback?: (arg0: object[], arg1: RelationMap[]) => any
  ): Promise<this>;
  sort(sort: Object);
  limit(limit: number);
  skip(skip: number);
  paginate(paginate: boolean, seekingPipeline: any[]): Promise<this>;
  result(): any[];
}

export class PipelineBuilder implements iPipelineBuilder {
  private pipeline: Object[] = [];
  private schema: Bucket;
  private factories: CrudFactories<any>;
  private _locale;
  private usedRelationPaths: string[] = [];

  public get locale() {
    return this._locale;
  }
  public set locale(value) {
    this._locale = value;
  }

  constructor(schema: Bucket, factories: CrudFactories<any>) {
    this.schema = schema;
    this.factories = factories;
  }

  private extractFilterPropertyMap(filter: any) {
    const map: string[][] = [];
    for (const fields of Object.keys(filter)) {
      const field = fields.split(".");
      map.push(field);
    }
    return map;
  }

  private async createRelationMap(propertyMap): Promise<RelationMap[]> {
    let relationMap = await createRelationMap({
      paths: propertyMap,
      properties: this.schema.properties,
      resolve: this.factories.schema
    });
    return relationMap;
  }

  attachToPipeline(condition, ...attachedObject: object[]) {
    if (condition) {
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
  async localize(isLocalizationRequested: boolean, language: string, callBack): Promise<this> {
    if (isLocalizationRequested && hasTranslatedProperties(this.schema)) {
      this.locale = findLocale(language, await this.factories.preference());
      this.pipeline.push({
        $replaceWith: buildI18nAggregation("$$ROOT", this.locale.best, this.locale.fallback)
      });
      callBack(this.locale);
    }
    return this;
  }
  async rules(userId: string, callback): Promise<this> {
    this.attachToPipeline(true, {$set: {_id: {$toString: "$_id"}}});

    const rulePropertyMap = expression
      .extractPropertyMap(this.schema.acl.read)
      .map(path => path.split("."));

    let ruleRelationMap = await this.createRelationMap(rulePropertyMap);
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

      if (typeof filterByUserRequest == "object" && Object.keys(filterByUserRequest).length) {
        filterPropertyMap = this.extractFilterPropertyMap(filterByUserRequest);

        filterExpression = filterByUserRequest;
      } else if (typeof filterByUserRequest == "string") {
        filterPropertyMap = expression
          .extractPropertyMap(filterByUserRequest)
          .map(path => path.split("."));
        filterExpression = expression.aggregate(filterByUserRequest, {});
      }

      filterRelationMap = await this.createRelationMap(filterPropertyMap);
      const updatedFilterRelationMap = compareAndUpdateRelations(
        deepCopy(filterRelationMap),
        this.usedRelationPaths
      );
      const filterRelationStage = getRelationPipeline(updatedFilterRelationMap, this.locale);

      this.attachToPipeline(true, ...filterRelationStage);
      this.attachToPipeline(filterExpression, {$match: filterExpression});
    }
    return this;
  }
  async resolveRelationPath(relationPaths: string[][], callback): Promise<this> {
    let relationPropertyMap = relationPaths || [];
    let relationMap = [];
    if (relationPropertyMap.length) {
      relationMap = await this.createRelationMap(relationPaths);
      const updatedRelationMap = compareAndUpdateRelations(
        deepCopy(relationMap),
        this.usedRelationPaths
      );
      const relationStage = getRelationPipeline(updatedRelationMap, this.locale);
      callback(relationStage);
    }
    return this;
  }

  sort(sort: Object) {
    this.attachToPipeline(Object.keys(sort || {}).length, {$sort: sort});
    return this;
  }
  limit(limit: number) {
    this.attachToPipeline(limit, {$limit: limit});
    return this;
  }
  skip(skip: number) {
    this.attachToPipeline(skip, {$skip: skip});
    return this;
  }

  async paginate(paginate: boolean, seekingPipeline: any[]): Promise<this> {
    if (paginate) {
      this.pipeline.push(
        {
          $facet: {
            meta: [{$count: "total"}],
            data: seekingPipeline.length ? seekingPipeline : [{$unwind: "$_id"}]
          }
        },
        {$unwind: {path: "$meta", preserveNullAndEmptyArrays: true}}
      );
    }
    return this;
  }

  result(): any[] {
    return this.pipeline;
  }
}
