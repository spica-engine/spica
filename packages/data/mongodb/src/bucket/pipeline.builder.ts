import * as expression from "@spica-server/bucket-expression";
import {
  buildExpressionReplacers,
  categorizePropertyMap,
  compareAndUpdateRelations,
  constructFilterValues,
  createRelationMap,
  findLocale,
  hasTranslatedProperties
} from "@spica-server/bucket-common";
import {deepCopy} from "@spica-server/core-patch";
import {buildI18nAggregation, getRelationPipeline} from "./stages.js";
import {PipelineBuilder} from "@spica-server/database-pipeline";
import {extractFilterPropertyMap} from "@spica-server/filter";
import {BucketReadContext, Locale, RelationMap} from "@spica-server/interface-bucket-common";
import {Bucket} from "@spica-server/interface-bucket";

export class BucketPipelineBuilder extends PipelineBuilder {
  private schema: Bucket;
  private context: BucketReadContext;
  private usedRelationPaths: string[] = [];
  private locale: Locale;
  private hashSecret?: string;

  private defaultRule = "true==true";
  private isRuleFilteringDocuments: boolean;

  constructor(schema: Bucket, context: BucketReadContext) {
    super();
    this.schema = schema;
    this.context = context;
    this.hashSecret = context.hashSecret;
  }

  private buildRelationMap(propertyMap: string[][]): Promise<RelationMap[]> {
    return createRelationMap({
      paths: propertyMap,
      properties: this.schema.properties,
      resolve: this.context.resolveSchema
    });
  }

  async localize(
    isLocalizationRequested: boolean,
    language: string,
    callBack: (value: Locale) => void
  ): Promise<this> {
    if (isLocalizationRequested && hasTranslatedProperties(this.schema)) {
      this.locale = findLocale(language, await this.context.preferences());
      this.pipeline.push({
        $replaceWith: buildI18nAggregation("$$ROOT", this.locale.best, this.locale.fallback)
      });
      callBack(this.locale);
    }
    return this;
  }

  private areRulesSame(rule1: string, rule2: string) {
    const removeSpaceAndNewlines = (str: string) => str.replace(/[ |\n]/g, "");
    return removeSpaceAndNewlines(rule1) == removeSpaceAndNewlines(rule2);
  }

  async rules(
    user: any,
    callback?: (arg0: string[][], arg1: RelationMap[]) => void
  ): Promise<this> {
    this.isRuleFilteringDocuments = !this.areRulesSame(this.schema.acl.read, this.defaultRule);

    const propertyMap = expression.extractPropertyMap(this.schema.acl.read);
    const {documentPropertyMap} = categorizePropertyMap(propertyMap);

    const documentRelationMap = await this.buildRelationMap(documentPropertyMap);
    const documentRelationStage = getRelationPipeline(documentRelationMap, this.locale);

    const expressionReplacers = await buildExpressionReplacers(
      this.schema,
      documentPropertyMap,
      this.context.resolveSchema,
      this.hashSecret
    );
    const ruleExpression = expression.aggregateWithReplacers(
      this.schema.acl.read,
      {auth: user},
      "match",
      expressionReplacers
    );

    this.attachToPipeline(true, ...documentRelationStage);
    this.attachToPipeline(true, {$match: ruleExpression});

    callback(documentPropertyMap, documentRelationMap);
    return this;
  }

  async filterByUserRequest(filterByUserRequest: string | object) {
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
        filterByUserRequest = await constructFilterValues(
          filterByUserRequest,
          this.schema,
          this.context.resolveSchema,
          this.hashSecret
        );

        filterPropertyMap = extractFilterPropertyMap(filterByUserRequest);
        filterExpression = filterByUserRequest;
      } else if (typeof filterByUserRequest == "string") {
        const rawPropertyMap = expression.extractPropertyMap(filterByUserRequest);
        const {documentPropertyMap} = categorizePropertyMap(rawPropertyMap);
        filterPropertyMap = documentPropertyMap;

        const expressionReplacers = await buildExpressionReplacers(
          this.schema,
          filterPropertyMap,
          this.context.resolveSchema,
          this.hashSecret
        );

        filterExpression = expression.aggregateWithReplacers(
          filterByUserRequest,
          {},
          "match",
          expressionReplacers
        );
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

  protected isTotalDocumentCountAffected(): boolean {
    return this.isFilterApplied || this.isRuleFilteringDocuments;
  }

  result(): object[] {
    return this.pipeline;
  }
}
