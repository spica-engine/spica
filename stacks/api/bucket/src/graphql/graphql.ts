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
  getUpdateQuery,
  aggregationsFromRequestedFields,
  getProjectAggregation,
  requestedFieldsFromInfo,
  requestedFieldsFromExpression,
  deepCopy
} from "./schema";
import {BucketDataService} from "../bucket-data.service";
import {findLocale} from "../locale";
import {createHistory, clearRelations} from "../utility";
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

  schema: GraphQLSchema;

  constructor(
    private adapterHost: HttpAdapterHost,
    private bs: BucketService,
    private bds: BucketDataService,
    private guardService: GuardService,
    private validator: Validator,
    @Optional() private activity: ActivityService,
    @Optional() private history: HistoryService
  ) {
    this.bs.watchAll(true).subscribe(buckets => {
      this.buckets = buckets;
      this.schema = this.getSchema(buckets);
    });
  }

  onModuleInit() {
    let app = this.adapterHost.httpAdapter.getInstance();

    app.use(
      "/graphql",
      graphqlHTTP(async (request, response, gqlParams) => {
        await this.authorize(request, response);

        await this.authenticate(request, "/bucket", {}, ["bucket:index"], {
          resourceFilter: true
        });

        return {
          schema: this.schema,
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

  getSchema(buckets: Bucket[]): GraphQLSchema {
    let typeDefs = [];
    let resolvers = [];

    if (buckets.length) {
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

  find(bucket: Bucket): Function {
    return async (
      root: any,
      {limit, skip, sort, language, schedule = false, query}: {[arg: string]: any},
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
      aggregation.push({$match: {_schedule: {$exists: schedule}}});

      let matchExpression = {};
      if (query && Object.keys(query).length) {
        matchExpression = extractAggregationFromQuery(
          deepCopy(bucket),
          query,
          deepCopy(this.buckets)
        );
      }

      let requestedFields = requestedFieldsFromExpression(matchExpression, []).concat(
        requestedFieldsFromInfo(info, "entries")
      );

      let relationAndLocalization = await aggregationsFromRequestedFields(
        deepCopy(bucket),
        requestedFields,
        this.getLocale,
        deepCopy(this.buckets),
        language
      );
      aggregation.push(...relationAndLocalization);

      aggregation.push({$match: matchExpression});

      if (requestedFields.length) {
        let project = getProjectAggregation(requestedFields);
        aggregation.push(project);
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

      return this.bds.find(bucket._id, aggregation).then(response => {
        if (!response.length) {
          return {meta: {total: 0}, entries: []};
        }
        return response[0] as FindResponse;
      });
    };
  }

  findById(bucket: Bucket): Function {
    return async (
      root: any,
      {_id: documentId, language}: {[arg: string]: any},
      context: any,
      info: GraphQLResolveInfo
    ): Promise<BucketDocument> => {
      await this.authenticate(
        context,
        "/bucket/:bucketId/data/:documentId",
        {bucketId: bucket._id, documentId: documentId},
        ["bucket:data:show"],
        {resourceFilter: false}
      );

      let aggregation = [];

      let requestedFields = requestedFieldsFromInfo(info);
      let relationAndLocalization = await aggregationsFromRequestedFields(
        deepCopy(bucket),
        requestedFields,
        this.getLocale,
        deepCopy(this.buckets),
        language
      );
      aggregation.push(...relationAndLocalization);

      aggregation.push({$match: {_id: documentId}});

      let project = getProjectAggregation(requestedFields);
      aggregation.push(project);

      return this.bds.find(bucket._id, aggregation).then(([documents]) => {
        return documents;
      });
    };
  }

  insert(bucket: Bucket): Function {
    return async (
      root: any,
      {input}: {[arg: string]: any},
      context: any,
      info: GraphQLResolveInfo
    ): Promise<BucketDocument> => {
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

      let aggregation = [];

      let requestedFields = requestedFieldsFromInfo(info);
      let relationAndLocalization = await aggregationsFromRequestedFields(
        deepCopy(bucket),
        requestedFields,
        this.getLocale,
        deepCopy(this.buckets)
      );
      aggregation.push(...relationAndLocalization);

      aggregation.push({$match: {_id: insertResult.insertedId}});

      let project = getProjectAggregation(requestedFields);
      aggregation.push(project);

      return this.bds.find(bucket._id, aggregation).then(([documents]) => documents);
    };
  }

  replace(bucket: Bucket): Function {
    return async (
      root: any,
      {_id: documentId, input}: {[arg: string]: any},
      context: any,
      info: GraphQLResolveInfo
    ): Promise<BucketDocument> => {
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

      let aggregation = [];

      let requestedFields = requestedFieldsFromInfo(info);
      let relationAndLocalization = await aggregationsFromRequestedFields(
        deepCopy(bucket),
        requestedFields,
        this.getLocale,
        deepCopy(this.buckets)
      );
      aggregation.push(...relationAndLocalization);

      aggregation.push({$match: {_id: documentId}});

      let project = getProjectAggregation(requestedFields);
      aggregation.push(project);

      return this.bds.find(bucket._id, aggregation).then(([documents]) => documents);
    };
  }

  patch(bucket: Bucket): Function {
    return async (
      root: any,
      {_id: documentId, input}: {[arg: string]: any},
      context: any,
      info: GraphQLResolveInfo
    ) => {
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

      let aggregation = [];

      let requestedFields = requestedFieldsFromInfo(info);
      let relationAndLocalization = await aggregationsFromRequestedFields(
        deepCopy(bucket),
        requestedFields,
        this.getLocale,
        deepCopy(this.buckets)
      );
      aggregation.push(...relationAndLocalization);

      aggregation.push({$match: {_id: documentId}});

      let project = getProjectAggregation(requestedFields);
      aggregation.push(project);

      return this.bds.find(bucket._id, aggregation).then(([documents]) => documents);
    };
  }

  delete(bucket: Bucket): Function {
    return async (
      root: any,
      {_id: documentId}: {[arg: string]: any},
      context: any,
      info: GraphQLResolveInfo
    ): Promise<string> => {
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

  getLocale = async (language?: string) => {
    const preferences = await this.bs.getPreferences();
    return findLocale(language ? language : preferences.language.default, preferences);
  };
}

function throwError(message: string, statusCode: number) {
  throw new GraphQLError(message, null, null, null, null, null, {
    statusCode: statusCode
  });
}
