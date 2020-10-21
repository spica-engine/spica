import {graphqlHTTP} from "express-graphql";
import {HttpAdapterHost} from "@nestjs/core";
import {Injectable, Optional, PipeTransform, OnModuleInit} from "@nestjs/common";
import {ObjectID, ObjectId} from "@spica-server/database";
import {BucketService, Bucket, BucketDocument} from "@spica-server/bucket/services";
import {
  GraphQLScalarType,
  ValueNode,
  GraphQLError,
  GraphQLSchema,
  GraphQLResolveInfo
} from "graphql";

import {makeExecutableSchema, mergeTypeDefs, mergeResolvers} from "graphql-tools";
import {GuardService} from "@spica-server/passport";
import {HistoryService} from "@spica-server/bucket/history";
import {createActivity, ActivityService, Action} from "@spica-server/activity/services";
import {createBucketDataActivity} from "../activity.resource";
import {Validator, Schema} from "@spica-server/core/schema";
import {
  getBucketName,
  createSchema,
  extractAggregationFromQuery,
  getPatchedDocument,
  getUpdateQuery
} from "./schema";
import {BucketDataService} from "../bucket-data.service";
import {
  Locale,
  hasTranslatedProperties,
  findLocale,
  buildI18nAggregation,
  hasRelationalProperties
} from "../locale";
import {buildRelationAggregation, createHistory, clearRelations} from "../utility";
import {resourceFilterFunction} from "@spica-server/passport/guard/src/action.guard";

interface FindResponse {
  meta: {total: number};
  entries: BucketDocument[];
}

@Injectable()
export class GraphqlController implements OnModuleInit {
  buckets: Bucket[] = [];

  validatorPipes: Map<ObjectId, PipeTransform<any, any>> = new Map();

  staticTypes = `
    scalar Date

    scalar JSON

    scalar ObjectID
    
    type Meta{
      total: Int
    }

    type Location{
      latitude: Float
      longitude: Float
    }

    input LocationInput{
      latitude: Float
      longitude: Float
    }
  `;

  staticResolvers = {
    Date: new GraphQLScalarType({
      name: "Date",
      description: "JavaScript Date object. Value will be passed to Date constructor."
    }),

    JSON: new GraphQLScalarType({
      name: "JSON",
      description: "JavaScript Object Notation."
    }),

    ObjectID: new GraphQLScalarType({
      name: "ObjectID",
      description:
        "BSON ObjectId type. Can be a 24 byte hex string, 12 byte binary string or a Number.",
      parseValue(value) {
        return new ObjectID(value);
      },
      serialize(value) {
        return value.toString();
      },
      parseLiteral(ast: ValueNode) {
        let value = ast["value"];
        if (ObjectID.isValid(value)) {
          return new ObjectID(value);
        }
        return null;
      }
    })
  };

  constructor(
    private adapterHost: HttpAdapterHost,
    private bs: BucketService,
    private bds: BucketDataService,
    private guardService: GuardService,
    private validator: Validator,
    @Optional() private activity: ActivityService,
    @Optional() private history: HistoryService
  ) {}

  onModuleInit() {
    let app = this.adapterHost.httpAdapter.getInstance();

    app.use(
      "/graphql",
      graphqlHTTP(async (request, response, gqlParams) => {
        await this.authorize(request, response);

        let filterAggregation = await this.authenticate(request, "/bucket", {}, ["bucket:index"], {
          resourceFilter: true
        });

        const schema = await this.getSchema(filterAggregation);

        return {
          schema: schema,
          graphiql: true,
          customFormatErrorFn: err => {
            if (err.extensions && err.extensions.statusCode) {
              response.statusCode = err.extensions.statusCode;
              delete err.extensions.statusCode;
            }
            return err;
          }
        };
      })
    );
  }

  async getSchema(filterAggregation: object): Promise<GraphQLSchema> {
    let buckets = await this.bs.aggregate([filterAggregation]).toArray();

    let typeDefs = [];
    let resolvers = [];

    if (buckets.length) {
      this.buckets = buckets;
      typeDefs = buckets.map(bucket => createSchema(bucket, this.staticTypes));

      resolvers = buckets.map(bucket => this.createResolver(bucket, this.staticResolvers));
    } else {
      //graphql needs a default schema that includes one type and resolver at least
      typeDefs = [
        `type Query{
          spica: String
        }`
      ];

      resolvers = [
        {
          Query: {
            spica: () => "Spica"
          }
        }
      ];
    }
    return makeExecutableSchema({
      typeDefs: mergeTypeDefs(typeDefs),
      resolvers: mergeResolvers(resolvers)
    });
  }

  createResolver(bucket: Bucket, staticResolvers: object) {
    let name = getBucketName(bucket._id);
    let resolver = {
      ...staticResolvers,

      Query: {
        [`Find${name}`]: this.find(bucket),
        [`FindBy${name}Id`]: this.findById(bucket)
      },

      Mutation: {
        [`insert${name}`]: this.insert(bucket),
        [`replace${name}`]: this.replace(bucket),
        [`patch${name}`]: this.patch(bucket),
        [`delete${name}`]: this.delete(bucket)
      }
    };

    return resolver;
  }

  extractFields(node: any, fields: string[]) {
    let result = [];
    node.selectionSet.selections.forEach(selection => {
      let currentPath = fields.concat([selection.name.value]);

      if (selection.selectionSet) {
        result = result.concat(this.extractFields(selection, currentPath));
      } else {
        result.push(currentPath);
      }
    });

    return result;
  }

  getRelationAggregation(properties: object, fields: string[][], locale: Locale) {
    let aggregations = [];
    for (const [key, value] of Object.entries(properties)) {
      if (value.type == "relation") {
        let relateds = fields.filter(field => field[0] == key);
        if (relateds.length) {
          let aggregation = buildRelationAggregation(
            key,
            value.bucketId,
            value.relationType,
            locale,
            true
          );

          //Remove first key
          relateds = relateds.map(field => {
            field.splice(0, 1);
            return field;
          });

          let relatedBucket = this.buckets.find(
            bucket => bucket._id.toHexString() == value.bucketId
          );

          aggregation[0].$lookup.pipeline.push(
            ...this.getRelationAggregation(relatedBucket.properties, relateds, locale)
          );

          aggregations.push(...aggregation);
        }
      }
    }
    return aggregations;
  }

  mergeNodes(node: any, rootKey: string) {
    if (
      node.selectionSet &&
      node.selectionSet.selections.some(selection => selection.name.value == rootKey)
    ) {
      //return node;
      let mergedNode = node.selectionSet.selections
        .filter(selection => selection.name.value == rootKey)
        .reduce(
          (acc, curr) => {
            acc.selectionSet.selections.push(...curr.selectionSet.selections);
            return acc;
          },
          {selectionSet: {selections: []}} as any
        );
      return mergedNode;
    }
    return {selectionSet: {selections: []}};
  }

  findRequestedFields(info: GraphQLResolveInfo, rootKey?: string) {
    let [result] = info.fieldNodes.map(node =>
      this.extractFields(rootKey ? this.mergeNodes(node, rootKey) : node, [])
    );

    return result;
  }

  getProjectAggregation(fields: string[][]) {
    let result = {};
    fields.forEach(field => {
      let mergedField = field.join(".");
      result[mergedField] = 1;
    });
    return {$project: result};
  }

  async aggregationsFromRequestedFields(
    bucket: Bucket,
    info: GraphQLResolveInfo,
    rootKey?: string,
    language?: string
  ) {
    let aggregations = [];

    let requestedFields = this.findRequestedFields(info, rootKey);

    let locale;
    if (requestedFields.length) {
      if (this.relationalFieldRequested(bucket.properties, requestedFields)) {
        locale = await this.getLocale(language);
        let relationAggregation = this.getRelationAggregation(
          bucket.properties,
          JSON.parse(JSON.stringify(requestedFields)),
          locale
        );
        aggregations.push(...relationAggregation);
      }

      if (this.translatableFieldsRequested(bucket.properties, requestedFields)) {
        locale = locale ? locale : await this.getLocale(language);
        aggregations.push({
          $replaceWith: buildI18nAggregation("$$ROOT", locale.best, locale.fallback)
        });
      }

      let project = this.getProjectAggregation(requestedFields);
      aggregations.push(project);
    }

    return aggregations;
  }

  relationalFieldRequested(properties: object, requestedFields: string[][]) {
    let relatedFields = [];
    Object.keys(properties).forEach(key => {
      if (properties[key].type == "relation") {
        relatedFields.push(key);
      }
    });

    return requestedFields.some(fields => relatedFields.includes(fields[0]));
  }

  translatableFieldsRequested(properties: object, requestedFields: string[][]) {
    let translatableFields = [];
    Object.keys(properties).forEach(key => {
      if (properties[key].options && properties[key].options.translate) {
        translatableFields.push(key);
      }
    });

    return requestedFields.some(fields => translatableFields.includes(fields[0]));
  }

  find(bucket: Bucket): Function {
    return async (
      root: any,
      {limit, skip, sort, language, query}: {[arg: string]: any},
      context: any,
      info: GraphQLResolveInfo
    ): Promise<FindResponse> => {
      let resourceFilterAggregation = await this.authenticate(
        context,
        "/bucket/:bucketId/data",
        {bucketId: bucket._id},
        ["bucket:data:index"],
        {resourceFilter: true}
      );

      let aggregation = [];

      aggregation.push(resourceFilterAggregation);

      let additionalAggregations = await this.aggregationsFromRequestedFields(
        bucket,
        info,
        "entries",
        language
      );

      aggregation.push(...additionalAggregations);

      if (query && Object.keys(query).length) {
        let matchExpression = extractAggregationFromQuery(
          JSON.parse(JSON.stringify(bucket)),
          query,
          this.buckets
        );
        if (Object.keys(matchExpression).length) {
          aggregation.push({$match: matchExpression});
        }
      }

      let subAggregation = [];
      if (sort && Object.keys(sort).length) {
        subAggregation.push({$sort: sort});
      }

      subAggregation.push({$skip: skip | 0});

      if (limit) {
        subAggregation.push({$limit: limit});
      }

      aggregation.push(
        {
          $facet: {
            meta: [{$count: "total"}],
            entries: subAggregation
          }
        },
        {$unwind: "$meta"}
      );

      console.dir(aggregation, {depth: Infinity});

      return this.bds
        .find(bucket._id, aggregation)
        .then(response => {
          console.dir(response, {depth: Infinity});
          if (!response.length) {
            return {meta: {total: 0}, entries: []};
          }
          return response[0] as FindResponse;
        })
        .catch(e => {
          console.log(e);
          return e;
        });
    };
  }

  findById(bucket: Bucket): Function {
    return async (root, {_id: documentId, language}, context, info): Promise<BucketDocument> => {
      await this.authenticate(
        context,
        "/bucket/:bucketId/data/:documentId",
        {bucketId: bucket._id, documentId: documentId},
        ["bucket:data:show"],
        {resourceFilter: false}
      );

      let aggregation = [];

      let additionalAggregations = await this.aggregationsFromRequestedFields(bucket, info);
      aggregation.push(...additionalAggregations);

      aggregation.push({$match: {_id: documentId}});

      // let aggregation = await this.localizationAndRelation(bucket, language);
      // aggregation.push({$match: {_id: documentId}});

      console.dir(aggregation, {depth: Infinity});

      return this.bds.find(bucket._id, aggregation).then(([documents]) => {
        console.dir(documents,{depth:Infinity});
        return documents;
      });
    };
  }

  insert(bucket: Bucket): Function {
    return async (root, {input}, context): Promise<BucketDocument> => {
      await this.authenticate(
        context,
        "/bucket/:bucketId/data",
        {bucketId: bucket._id},
        ["bucket:data:create"],
        {resourceFilter: false}
      );

      await this.validateInput(bucket._id, input).catch(error => throwError(error.message, 400));

      let insertResult = await this.bds.insertOne(bucket._id, input);

      if (this.activity) {
        const _ = this.insertActivity(context, Action.POST, bucket._id, insertResult.insertedId);
      }

      let aggregation = await this.localizationAndRelation(bucket);
      aggregation.push({$match: {_id: insertResult.insertedId}});

      return this.bds.find(bucket._id, aggregation).then(([documents]) => documents);
    };
  }

  replace(bucket: Bucket): Function {
    return async (root, {_id: documentId, input}, context): Promise<BucketDocument> => {
      await this.authenticate(
        context,
        "/bucket/:bucketId/data/:documentId",
        {bucketId: bucket._id, documentId: documentId},
        ["bucket:data:update"],
        {resourceFilter: false}
      );

      await this.validateInput(bucket._id, input).catch(error => throwError(error.message, 400));

      const {value: previousDocument} = await this.bds.replaceOne(
        bucket._id,
        {_id: documentId},
        input,
        {
          returnOriginal: true
        }
      );

      const currentDocument = {...input, _id: documentId};

      if (this.activity) {
        const _ = this.insertActivity(context, Action.PUT, bucket._id, documentId);
      }

      if (this.history) {
        const promise = createHistory(
          this.bs,
          this.history,
          bucket._id,
          previousDocument,
          currentDocument
        );
      }

      let aggregation = await this.localizationAndRelation(bucket);
      aggregation.push({$match: {_id: documentId}});

      return this.bds.find(bucket._id, aggregation).then(([documents]) => documents);
    };
  }

  patch(bucket: Bucket): Function {
    return async (root, {_id: documentId, input}, context) => {
      await this.authenticate(
        context,
        "/bucket/:bucketId/data/:documentId",
        {bucketId: bucket._id, documentId: documentId},
        ["bucket:data:update"],
        {resourceFilter: false}
      );

      let previousDocument = await this.bds.findOne(bucket._id, {_id: documentId});

      let patchedDocument = getPatchedDocument(previousDocument, input);

      await this.validateInput(bucket._id, patchedDocument).catch(error =>
        throwError(error.message, 400)
      );

      let updateQuery = getUpdateQuery(previousDocument, patchedDocument);

      if (!Object.keys(updateQuery).length) {
        throw Error("There is no difference between previous and current documents.");
      }

      let currentDocument = await this.bds.findOneAndUpdate(
        bucket._id,
        {_id: documentId},
        updateQuery,
        {returnOriginal: false}
      );

      if (this.history) {
        const promise = createHistory(
          this.bs,
          this.history,
          bucket._id,
          previousDocument,
          currentDocument
        );
      }

      if (this.activity) {
        const _ = this.insertActivity(context, Action.PUT, bucket._id, documentId);
      }

      let aggregation = await this.localizationAndRelation(bucket);
      aggregation.push({$match: {_id: documentId}});

      return this.bds.find(bucket._id, aggregation).then(([documents]) => documents);
    };
  }

  delete(bucket: Bucket): Function {
    return async (root, {_id: documentId}, context): Promise<string> => {
      await this.authenticate(
        context,
        "/bucket/:bucketId/data/:documentId",
        {bucketId: bucket._id, documentId: documentId},
        ["bucket:data:delete"],
        {resourceFilter: false}
      );

      await clearRelations(this.bs, bucket._id, documentId);
      if (this.history) {
        const promise = this.history.deleteMany({
          document_id: documentId
        });
      }

      let result = await this.bds.deleteOne(bucket._id, {_id: documentId}).then(res => res.result);

      if (this.activity) {
        const _ = this.insertActivity(context, Action.DELETE, bucket._id, documentId);
      }

      return "";
    };
  }

  async getLocale(language?: string) {
    const preferences = await this.bs.getPreferences();
    return findLocale(language ? language : preferences.language.default, preferences);
  }

  getI18nAggregation(bucket: Bucket, locale: Locale) {
    let aggregation = [];
    aggregation.push({
      $replaceWith: buildI18nAggregation("$$ROOT", locale.best, locale.fallback)
    });
    return aggregation;
  }

  // getRelationAggregation(bucket: Bucket, locale: Locale) {
  //   let aggregation = [];
  //   for (const propertyKey in bucket.properties) {
  //     const property = bucket.properties[propertyKey];
  //     if (property.type == "relation") {
  //       aggregation.push(
  //         ...buildRelationAggregation(
  //           propertyKey,
  //           property["bucketId"],
  //           property["relationType"],
  //           locale,
  //           false
  //         )
  //       );
  //     }
  //   }
  //   return aggregation;
  // }

  async localizationAndRelation(bucket: Bucket, language?: string) {
    const needTranslate = hasTranslatedProperties(bucket.properties);
    const needRelation = hasRelationalProperties(bucket.properties);

    if (!needTranslate && !needRelation) {
      return Promise.resolve([]);
    }

    let locale = await this.getLocale(language);

    let aggregation = [];

    if (needTranslate) {
      let i18nAggregation = this.getI18nAggregation(bucket, locale);
      aggregation.push(...i18nAggregation);
    }

    // if (needRelation) {
    //   let relationAggregation = this.getRelationAggregation(bucket, locale);
    //   aggregation.push(...relationAggregation);
    // }

    return aggregation;
  }

  insertActivity(
    context: any,
    method: Action,
    bucketId: string | ObjectId,
    documentId: string | ObjectId
  ) {
    context.params.bucketId = bucketId;
    context.params.documentId = documentId;
    context.method = Action[method];

    const response = {
      _id: documentId
    };

    return createActivity(
      {
        switchToHttp: () => ({
          getRequest: () => context
        })
      } as any,
      response,
      createBucketDataActivity,
      this.activity
    );
  }

  validateInput(bucketId: ObjectId, input: BucketDocument): Promise<any> {
    let pipe: any = this.validatorPipes.get(bucketId);

    if (!pipe) {
      let validatorMixin = Schema.validate(bucketId.toHexString());
      pipe = new validatorMixin(this.validator);
      this.validatorPipes.set(bucketId, pipe);
    }

    return pipe.transform(input);
  }

  async authorize(req: any, res: any) {
    await this.guardService
      .checkAuthorization({
        request: req,
        response: res
      })
      .catch(error => {
        throwError(error.message, 401);
      });
  }

  async authenticate(
    req: any,
    path: string,
    params: object,
    actions: string[],
    options: {resourceFilter: boolean}
  ) {
    req.route = {
      path: path
    };
    req.params = params;
    await this.guardService
      .checkAction({
        request: req,
        response: {},
        actions: actions,
        options: options
      })
      .catch(error => {
        throwError(error.message, 403);
      });
    if (options.resourceFilter) {
      return resourceFilterFunction({}, {
        switchToHttp: () => {
          return {
            getRequest: () => req
          };
        }
      } as any);
    }

    return;
  }
}

function throwError(message: string, statusCode: number) {
  throw new GraphQLError(message, null, null, null, null, null, {
    statusCode: statusCode
  });
}
