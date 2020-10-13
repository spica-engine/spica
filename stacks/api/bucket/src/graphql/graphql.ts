import {graphqlHTTP} from "express-graphql";
import {HttpAdapterHost} from "@nestjs/core";
import {Injectable, UnauthorizedException, Optional, PipeTransform} from "@nestjs/common";
import {ObjectID, ObjectId} from "@spica-server/database";
import {BucketService, Bucket, BucketDocument} from "@spica-server/bucket/services";
import {GraphQLScalarType, GraphQLSchema, ValueNode} from "graphql";

import {makeExecutableSchema, mergeTypeDefs, mergeResolvers} from "graphql-tools";
import {GuardService} from "@spica-server/passport";
import {HistoryService} from "@spica-server/bucket/history";
import {createActivity, ActivityService} from "@spica-server/activity/services";
import {createBucketDataActivity} from "../activity.resource";
import {Validator} from "@spica-server/core/schema";
import {
  getBucketName,
  createSchema,
  extractAggregationFromQuery,
  getPatchedDocument,
  getUpdateQuery,
  validateInput
} from "./schema";
import {BucketDataService} from "../bucket-data.service";
import {Locale, hasTranslatedProperties, findLocale, buildI18nAggregation} from "../locale";
import {buildRelationAggregation, createHistory, clearRelations} from "../utility";

interface FindResponse {
  meta: {total: number};
  entries: BucketDocument[];
}

@Injectable()
export class GraphqlController {
  schema: GraphQLSchema;

  buckets: Bucket[] = [];

  validatorPipes: Map<ObjectId, PipeTransform<any, any>> = new Map();

  //graphql needs a default schema that includes one type and resolver at least
  typeDefs = [
    `type Query{
      spica: String
    }`
  ];

  resolvers: any[] = [
    {
      Query: {
        spica: () => "Spica"
      }
    }
  ];

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

  dateScalar = new GraphQLScalarType({
    name: "Date",
    description: "JavaScript Date object. Value will be passed to Date constructor."
  });

  JSONScalar = new GraphQLScalarType({
    name: "JSON",
    description: "JavaScript Object Notation."
  });

  objectIdScalar = new GraphQLScalarType({
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
  });

  constructor(
    private adapterHost: HttpAdapterHost,
    private bs: BucketService,
    private bds: BucketDataService,
    private guardService: GuardService,
    private activity: ActivityService,
    private validator: Validator,
    @Optional() private history: HistoryService
  ) {
    let app = this.adapterHost.httpAdapter.getInstance();

    this.bs.watchCollection(true).subscribe(buckets => {
      this.buckets = buckets;

      if (buckets.length) {
        //typeDefs
        this.typeDefs = buckets.map(bucket => createSchema(bucket,this.staticTypes));
        
        //resolvers
        this.resolvers = buckets.map(bucket => this.createResolver(bucket));
        this.resolvers.push({
          Date: this.dateScalar,
          ObjectID: this.objectIdScalar,
          JSON: this.JSONScalar
        });
      }

      this.schema = makeExecutableSchema({
        typeDefs: mergeTypeDefs(this.typeDefs),
        resolvers: mergeResolvers(this.resolvers)
      });
    });

    app.use(
      "/graphql",
      graphqlHTTP(async (request, response, gqlParams) => {
        let isAuthorized = await this.guardService
          .checkAuthorization({
            request,
            response
          })
          .catch(err => {
            //console.log(err);

            //for development
            return true;
          });

        if (!isAuthorized) {
          throw new UnauthorizedException();
        }

        return {
          schema: this.schema,
          graphiql: true
        };
      })
    );
  }

  createResolver(bucket: Bucket) {
    let name = getBucketName(bucket._id);
    let resolver = {
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

  //resolver methods
  find(bucket: Bucket): Function {
    return async (root, {limit, skip, sort, language, query}, context): Promise<FindResponse> => {
      let subAggregation = [];

      let locale: Locale;
      if (hasTranslatedProperties(bucket.properties)) {
        const preferences = await this.bs.getPreferences();
        locale = findLocale(language ? language : preferences.language.default, preferences);

        subAggregation.push({
          $replaceWith: buildI18nAggregation("$$ROOT", locale.best, locale.fallback)
        });
      }

      for (const propertyKey in bucket.properties) {
        const property = bucket.properties[propertyKey];
        if (property.type == "relation") {
          subAggregation.push(
            ...buildRelationAggregation(
              propertyKey,
              property["bucketId"],
              property["relationType"],
              locale
            )
          );
        }
      }

      if (query && Object.keys(query).length) {
        let matchExpression = extractAggregationFromQuery(bucket, query);
        if (matchExpression && Object.keys(matchExpression).length) {
          subAggregation.push({$match: matchExpression});
        }
      }

      subAggregation.push({$skip: skip | 0});

      if (limit) {
        subAggregation.push({$limit: limit});
      }

      if (sort && Object.keys(sort).length) {
        subAggregation.push({$sort: sort});
      }

      let aggregation = [
        {
          $facet: {
            meta: [{$count: "total"}],
            entries: subAggregation
          }
        },
        {$unwind: "$meta"}
      ];

      return this.bds.find(bucket._id, aggregation).then(response => response[0] as FindResponse);
    };
  }

  findById(bucket: Bucket): Function {
    return async (root, {_id, language}, context): Promise<BucketDocument> => {
      let aggregation = [];

      aggregation.push({
        $match: {
          _id: _id
        }
      });

      let locale: Locale;
      if (hasTranslatedProperties(bucket.properties)) {
        const preferences = await this.bs.getPreferences();
        locale = findLocale(language ? language : preferences.language.default, preferences);

        aggregation.push({
          $replaceWith: buildI18nAggregation("$$ROOT", locale.best, locale.fallback)
        });
      }

      for (const propertyKey in bucket.properties) {
        const property = bucket.properties[propertyKey];
        if (property.type == "relation") {
          aggregation.push(
            ...buildRelationAggregation(
              propertyKey,
              property["bucketId"],
              property["relationType"],
              locale
            )
          );
        }
      }

      return this.bds.find(bucket._id, aggregation).then(entries => entries[0]);
    };
  }

  insert(bucket: Bucket): Function {
    return async (root, {input}, context): Promise<BucketDocument> => {
      // await this.guardService.checkAuthorization({
      //   request: context,
      //   response: {}
      // });

      await validateInput(bucket._id, input, this.validator);

      let insertResult = await this.bds.insertOne(bucket._id, input);

      const _ = this.insertActivity(context, "POST", bucket._id, insertResult.insertedId);

      //resolve relations if bucket has relation field
      if (
        Object.keys(bucket.properties).some(
          property => bucket.properties[property].type == "relation"
        )
      ) {
        let findById = this.findById(bucket);
        return findById(root, {_id: insertResult.insertedId, language: undefined}, context);
      }

      return {...input, _id: insertResult.insertedId};
    };
  }

  replace(bucket: Bucket): Function {
    return async (root, {_id, input}, context): Promise<BucketDocument> => {
      // await this.guardService.checkAuthorization({
      //   request: context,
      //   response: {}
      // });

      await validateInput(bucket._id, input, this.validator);

      const {value: previousDocument} = await this.bds.replaceOne(bucket._id, {_id: _id}, input, {
        returnOriginal: true
      });

      const currentDocument = {...input, _id: _id};

      const _ = this.insertActivity(context, "PUT", bucket._id, _id);

      if (this.history) {
        const promise = createHistory(
          this.bs,
          this.history,
          bucket._id,
          previousDocument,
          currentDocument
        );
      }

      if (
        Object.keys(bucket.properties).some(
          property => bucket.properties[property].type == "relation"
        )
      ) {
        let findById = this.findById(bucket);
        return findById(root, {_id, language: undefined}, context);
      }

      return currentDocument;
    };
  }

  patch(bucket: Bucket): Function {
    return async (root, {_id, input}, context) => {
      // await this.guardService.checkAuthorization({
      //   request: context,
      //   response: {}
      // });

      let document = await this.bds.findOne(bucket._id, {_id});

      let patchedDocument = getPatchedDocument(document, input);

      await validateInput(bucket._id, patchedDocument, this.validator);

      let updateQuery = getUpdateQuery(document, patchedDocument);

      //throwing error is another option
      if (!updateQuery || !Object.keys(updateQuery).length) {
        return Promise.resolve(patchedDocument);
      }

      return this.bds.findOneAndUpdate(bucket._id, {_id}, updateQuery, {returnOriginal: false});
    };
  }

  delete(bucket: Bucket): Function {
    return async (root, {_id}, context): Promise<Boolean> => {
      // await this.guardService.checkAuthorization({
      //   request: context,
      //   response: {}
      // });

      await clearRelations(this.bs, bucket._id, _id);
      if (this.history) {
        const promise = this.history.deleteMany({
          document_id: _id
        });
      }

      let result = await this.bds.deleteOne(bucket._id, {_id: _id}).then(res => !!res.deletedCount);

      const _ = this.insertActivity(context, "DELETE", bucket._id, _id);

      return result;
    };
  }

  //activity logs
  insertActivity(
    context: any,
    method: "POST" | "PUT" | "DELETE",
    bucketId: string | ObjectId,
    documentId: string | ObjectId
  ) {
    context.params.bucketId = bucketId;
    context.params.documentId = documentId;
    context.method = method;

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
}

//guards
async (req, res, params) => {
  try {
    await this.guardService.checkAuthorization({
      request: req,
      response: res
    });
    await this.guardService.checkAction({
      request: req,
      response: res,
      actions: ["bucket:data:create"]
    });
    return {
      schema: this.schema,
      //rootValue: this.resolver,
      graphiql: true
    };
  } catch (e) {
    console.log(e);
    throw new UnauthorizedException();
    //res.end(JSON.stringify({code: e.status || 500, message: e.message}));
  }
};
