import * as expression from "@spica-server/bucket/expression";
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
import {constructFilterValues} from "@spica-server/bucket/common";
import {categorizePropertyMap} from "./helpers";
import {PipelineBuilder} from "@spica-server/database/pipeline";
import {extractFilterPropertyMap} from "@spica/filter";

export class BucketPipelineBuilder extends PipelineBuilder {
  private schema: Bucket;
  private factories: CrudFactories<any>;
  private usedRelationPaths: string[] = [];
  private locale: Locale;

  private defaultRule = "true==true";
  private isRuleFilteringDocuments: boolean;

  constructor(schema: Bucket, factories: CrudFactories<any>) {
    super();
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
    const {documentPropertyMap, authPropertyMap} = categorizePropertyMap(propertyMap);

    const authRelationMap = await createRelationMap({
      paths: authPropertyMap,
      properties: this.factories.authResolver.getProperties(),
      resolve: this.factories.schema
    });
    const authRelationStage = getRelationPipeline(authRelationMap, undefined);
    user = await this.factories.authResolver.resolveRelations(user, authRelationStage);

    const documentRelationMap = await this.buildRelationMap(documentPropertyMap);
    const documentRelationStage = getRelationPipeline(documentRelationMap, this.locale);
    const ruleExpression = expression.aggregate(this.schema.acl.read, {auth: user});

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
          this.factories.schema
        );

        filterPropertyMap = extractFilterPropertyMap(filterByUserRequest);
        filterExpression = filterByUserRequest;
      } else if (typeof filterByUserRequest == "string") {
        filterPropertyMap = expression.extractPropertyMap(filterByUserRequest);
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

  async paginate(
    paginate: boolean,
    seekingPipeline: object[],
    totalDocumentCount: Promise<number>
  ): Promise<this> {
    return super.paginate(
      paginate,
      seekingPipeline,
      totalDocumentCount,
      () => this.isFilterApplied || this.isRuleFilteringDocuments
    );
  }

  result(): object[] {
    return this.pipeline;
  }
}
