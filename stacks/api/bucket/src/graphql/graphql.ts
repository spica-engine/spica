import {graphqlHTTP} from "express-graphql";
import {HttpAdapterHost} from "@nestjs/core";
import {
  Injectable,
  UnauthorizedException,
  Optional,
  PipeTransform,
  OnModuleInit
} from "@nestjs/common";
import {ObjectID, ObjectId} from "@spica-server/database";
import {BucketService, Bucket, BucketDocument} from "@spica-server/bucket/services";
import {GraphQLScalarType, GraphQLSchema, ValueNode} from "graphql";

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
import {Locale, hasTranslatedProperties, findLocale, buildI18nAggregation} from "../locale";
import {buildRelationAggregation, createHistory, clearRelations} from "../utility";

interface FindResponse {
  meta: {total: number};
  entries: BucketDocument[];
}

@Injectable()
export class GraphqlController implements OnModuleInit {
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

  schema: GraphQLSchema = makeExecutableSchema({
    typeDefs: mergeTypeDefs(this.typeDefs),
    resolvers: mergeResolvers(this.resolvers)
  });

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
    private activity: ActivityService,
    private validator: Validator,
    @Optional() private history: HistoryService
  ) {}

  onModuleInit() {
    let app = this.adapterHost.httpAdapter.getInstance();

    this.bs.watchCollection(true).subscribe(buckets => {
      this.buckets = buckets;

      if (buckets.length) {
        this.typeDefs = buckets.map(bucket => createSchema(bucket, this.staticTypes));

        this.resolvers = buckets.map(bucket => this.createResolver(bucket, this.staticResolvers));
      } else {
        this.typeDefs = [
          `type Query{
            spica: String
          }`
        ];

        this.resolvers = [
          {
            Query: {
              spica: () => "Spica"
            }
          }
        ];
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
        if (Object.keys(matchExpression).length) {
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
    return async (root, {_id: documentId, language}, context): Promise<BucketDocument> => {
      let aggregation = [];

      aggregation.push({
        $match: {
          _id: documentId
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

      return this.bds.find(bucket._id, aggregation).then(([documents]) => documents);
    };
  }

  insert(bucket: Bucket): Function {
    return async (root, {input}, context): Promise<BucketDocument> => {
      // await this.guardService.checkAuthorization({
      //   request: context,
      //   response: {}
      // });

      await this.validateInput(bucket._id, input);

      let insertResult = await this.bds.insertOne(bucket._id, input);

      const _ = this.insertActivity(context, Action.POST, bucket._id, insertResult.insertedId);

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
    return async (root, {_id: documentId, input}, context): Promise<BucketDocument> => {
      // await this.guardService.checkAuthorization({
      //   request: context,
      //   response: {}
      // });

      await this.validateInput(bucket._id, input);

      const {value: previousDocument} = await this.bds.replaceOne(
        bucket._id,
        {_id: documentId},
        input,
        {
          returnOriginal: true
        }
      );

      const currentDocument = {...input, _id: documentId};

      const _ = this.insertActivity(context, Action.PUT, bucket._id, documentId);

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
        return findById(root, {_id: documentId, language: undefined}, context);
      }

      return currentDocument;
    };
  }

  patch(bucket: Bucket): Function {
    return async (root, {_id: documentId, input}, context) => {
      // await this.guardService.checkAuthorization({
      //   request: context,
      //   response: {}
      // });

      let document = await this.bds.findOne(bucket._id, {_id: documentId});

      let patchedDocument = getPatchedDocument(document, input);

      await this.validateInput(bucket._id, patchedDocument);

      let updateQuery = getUpdateQuery(document, patchedDocument);

      if (!Object.keys(updateQuery).length) {
        throw Error("There is no difference between previous and current documents.");
      }

      const _ = this.insertActivity(context, Action.PUT, bucket._id, documentId);

      return this.bds.findOneAndUpdate(bucket._id, {_id: documentId}, updateQuery, {
        returnOriginal: false
      });
    };
  }

  delete(bucket: Bucket): Function {
    return async (root, {_id: documentId}, context): Promise<Boolean> => {
      // await this.guardService.checkAuthorization({
      //   request: context,
      //   response: {}
      // });

      await clearRelations(this.bs, bucket._id, documentId);
      if (this.history) {
        const promise = this.history.deleteMany({
          document_id: documentId
        });
      }

      let result = await this.bds
        .deleteOne(bucket._id, {_id: documentId})
        .then(res => !!res.deletedCount);

      const _ = this.insertActivity(context, Action.DELETE, bucket._id, documentId);

      return result;
    };
  }

  //activity logs
  insertActivity(
    context: any,
    method: Action,
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

  //document validation
  validateInput(bucketId: ObjectId, input: BucketDocument): Promise<any> {
    let pipe: any = this.validatorPipes.get(bucketId);

    if (!pipe) {
      let validatorMixin = Schema.validate(bucketId.toHexString());
      pipe = new validatorMixin(this.validator);
      this.validatorPipes.set(bucketId, pipe);
    }

    return pipe.transform(input);
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
