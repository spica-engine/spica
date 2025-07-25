import {
  ForbiddenException,
  Inject,
  Injectable,
  OnModuleInit,
  Optional,
  PipeTransform
} from "@nestjs/common";
import {HttpAdapterHost} from "@nestjs/core";
import {ActivityService} from "@spica-server/activity/services";
import {HistoryService} from "@spica-server/bucket/history";
import {ChangeEmitter} from "@spica-server/bucket/hooks";
import {BucketService} from "@spica-server/bucket/services";
import {Schema, Validator} from "@spica-server/core/schema";
import {ObjectId, ReturnDocument} from "@spica-server/database";
import {GuardService} from "@spica-server/passport";
import {resourceFilterFunction} from "@spica-server/passport/guard";
import {graphqlHTTP} from "express-graphql";
import {
  GraphQLError,
  GraphQLResolveInfo,
  GraphQLScalarType,
  GraphQLSchema,
  ValueNode
} from "graphql";
import {makeExecutableSchema} from "@graphql-tools/schema";
import {mergeResolvers, mergeTypeDefs} from "@graphql-tools/merge";
import {BucketDataService} from "@spica-server/bucket/services";
import {
  deleteDocument,
  findDocuments,
  insertDocument,
  patchDocument,
  replaceDocument,
  clearRelations,
  getDependents,
  findLocale,
  insertActivity
} from "@spica-server/bucket/common";
import {IAuthResolver, AUTH_RESOLVER} from "@spica-server/interface/bucket/common";
import {FindResponse} from "@spica-server/interface/bucket/graphql";
import {Bucket, BucketDocument} from "@spica-server/interface/bucket";

import {
  createSchema,
  extractAggregationFromQuery,
  getBucketName,
  requestedFieldsFromExpression,
  requestedFieldsFromInfo,
  validateBuckets
} from "./schema";
import {applyPatch, deepCopy} from "@spica-server/core/patch";
import {Action} from "@spica-server/interface/activity";
import {SchemaWarning} from "@spica-server/interface/bucket/graphql";

@Injectable()
export class GraphqlController implements OnModuleInit {
  buckets: Bucket[] = [];

  staticTypes = `
    scalar Date

    scalar JSON

    scalar ObjectId
    
    type Meta{
      total: Int
    }

    enum Point{
      Point
    }

    type PointLocation{
      type: Point
      coordinates: [ Float ]
    }
    
    input PointLocationInput{
      type: Point 
      coordinates: [ Float ]
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

    ObjectId: new GraphQLScalarType({
      name: "ObjectId",
      description:
        "BSON ObjectId type. Can be a 24 byte hex string, 12 byte binary string or a Number.",
      parseValue(value: string) {
        return new ObjectId(value);
      },
      serialize(value) {
        return value.toString();
      },
      parseLiteral(ast: ValueNode) {
        const value = ast["value"];
        if (ObjectId.isValid(value)) {
          return new ObjectId(value);
        }
        return null;
      }
    })
  };

  //graphql needs a default schema that includes one type and resolver at least
  defaultSchema: GraphQLSchema = makeExecutableSchema({
    typeDefs: mergeTypeDefs([
      `type Query{
        spica: String
      }`
    ]),
    resolvers: mergeResolvers([
      {
        Query: {
          spica: () => "Spica"
        }
      }
    ])
  });

  schema: GraphQLSchema;

  schemaWarnings: SchemaWarning[] = [];

  constructor(
    private adapterHost: HttpAdapterHost,
    private bs: BucketService,
    private bds: BucketDataService,
    private guardService: GuardService,
    private validator: Validator,
    @Inject(AUTH_RESOLVER) private authResolver: IAuthResolver,
    @Optional() private activity: ActivityService,
    @Optional() private history: HistoryService,
    @Optional() private hookChangeEmitter: ChangeEmitter
  ) {
    this.bs.schemaChangeEmitter.subscribe(() => {
      this.bs.find().then(buckets => {
        this.schemaWarnings = [];

        if (!buckets.length) {
          this.schema = this.defaultSchema;
          return;
        }

        try {
          const result = validateBuckets(buckets);
          this.buckets = result.buckets;
          this.schemaWarnings = result.warnings;
        } catch (err) {
          console.error("GraphQL bucket validation error: ", err);
        }

        this.schema = this.getSchema(this.buckets);
      });
    });
  }

  onModuleInit() {
    const app = this.adapterHost.httpAdapter.getInstance();

    app.use(
      "/graphql",
      graphqlHTTP(async (request, response, gqlParams) => {
        await this.authorize(request, response);

        await this.authenticate(request, "/bucket", {}, ["bucket:index"], {
          resourceFilter: true
        });

        if (this.schemaWarnings.length) {
          response.setHeader("Warning", JSON.stringify(this.schemaWarnings));
        }

        return {
          schema: this.schema,
          graphiql: true,
          customFormatErrorFn: err => {
            if (err.extensions && err.extensions.statusCode) {
              response.statusCode = err.extensions.statusCode as number;
              delete err.extensions.statusCode;
            }
            return err;
          }
        };
      })
    );
  }

  getSchema(buckets: Bucket[]): GraphQLSchema {
    const typeDefs = buckets.map(bucket =>
      createSchema(
        bucket,
        this.staticTypes,
        this.buckets.map(b => b._id.toString())
      )
    );
    const resolvers = buckets.map(bucket => this.createResolver(bucket, this.staticResolvers));

    return makeExecutableSchema({
      typeDefs: mergeTypeDefs(typeDefs),
      resolvers: mergeResolvers(resolvers)
    });
  }

  createResolver(bucket: Bucket, staticResolvers: object) {
    const name = getBucketName(bucket._id);
    const resolver = {
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
      {limit, skip, sort, language, query}: {[arg: string]: any},
      context: any,
      info: GraphQLResolveInfo
    ): Promise<FindResponse> => {
      const resourceFilter = await this.authenticate(
        context,
        "/bucket/:bucketId/data",
        {bucketId: bucket._id},
        ["bucket:data:index"],
        {resourceFilter: true}
      );

      let matchExpression = {};
      if (query && Object.keys(query).length) {
        matchExpression = extractAggregationFromQuery(
          deepCopy(bucket),
          query,
          deepCopy(this.buckets)
        );
      }

      const expressionFields = requestedFieldsFromExpression(matchExpression, []);
      const responseFields = requestedFieldsFromInfo(info, "data");

      return findDocuments(
        bucket,
        {
          language,
          req: context,
          limit,
          skip,
          sort,
          resourceFilter,
          relationPaths: [...expressionFields, ...responseFields],
          filter: matchExpression,
          projectMap: responseFields
        },
        {localize: true, paginate: true},
        {
          collection: (schema: Bucket) => this.bds.children(schema),
          preference: () => this.bs.getPreferences(),
          schema: (bucketId: string) => this.bs.findOne({_id: new ObjectId(bucketId)}),
          authResolver: this.authResolver
        }
      );
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

      const requestedFields = requestedFieldsFromInfo(info);

      const [document] = await findDocuments(
        bucket,
        {
          language,
          req: context,
          relationPaths: requestedFields,
          projectMap: requestedFields,
          documentId: new ObjectId(documentId)
        },
        {localize: true, paginate: false},
        {
          collection: (schema: Bucket) => this.bds.children(schema),
          preference: () => this.bs.getPreferences(),
          schema: (bucketId: string) =>
            Promise.resolve(this.buckets.find(b => b._id.toString() == bucketId)),
          authResolver: this.authResolver
        }
      );

      return document;
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

      const insertedDocument = await insertDocument(
        bucket,
        input,
        {req: context},
        {
          collection: bucketId => this.bds.children(bucketId),
          schema: (bucketId: string) => this.bs.findOne({_id: new ObjectId(bucketId)}),
          deleteOne: async documentId => {
            const deleteFn = this.delete(bucket, false);
            await deleteFn(root, {_id: documentId}, context, info);
          },
          authResolver: this.authResolver
        }
      ).catch(error => throwError(error.message, error instanceof ForbiddenException ? 403 : 500));
      if (!insertedDocument) {
        return;
      }

      if (this.activity) {
        const _ = insertActivity(
          context,
          Action.POST,
          bucket._id.toString(),
          insertedDocument._id,
          this.activity
        );
      }

      const requestedFields = requestedFieldsFromInfo(info);

      const [document] = await findDocuments(
        bucket,
        {
          relationPaths: requestedFields,
          projectMap: requestedFields,
          documentId: insertedDocument._id,
          req: context
        },
        {localize: true},
        {
          collection: (schema: Bucket) => this.bds.children(schema),
          preference: () => this.bs.getPreferences(),
          schema: (bucketId: string) => this.bs.findOne({_id: new ObjectId(bucketId)}),
          authResolver: this.authResolver
        }
      );

      if (this.hookChangeEmitter) {
        this.hookChangeEmitter.emitChange(
          {
            bucket: bucket._id.toHexString(),
            type: "insert"
          },
          document._id.toHexString(),
          undefined,
          document
        );
      }

      return document;
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

      const previousDocument = await replaceDocument(
        bucket,
        {...input, _id: documentId},
        {req: context},
        {
          collection: bucketId => this.bds.children(bucketId),
          schema: (bucketId: string) => this.bs.findOne({_id: new ObjectId(bucketId)}),
          authResolver: this.authResolver
        }
      ).catch(error => throwError(error.message, error instanceof ForbiddenException ? 403 : 500));

      if (!previousDocument) {
        return;
      }

      const currentDocument = {...input, _id: documentId};

      if (this.activity) {
        const _ = insertActivity(
          context,
          Action.PUT,
          bucket._id.toString(),
          documentId,
          this.activity
        );
      }

      if (this.history && bucket.history) {
        const promise = this.history.createHistory(bucket._id, previousDocument, currentDocument);
      }

      const requestedFields = requestedFieldsFromInfo(info);

      const [document] = await findDocuments(
        bucket,
        {
          relationPaths: requestedFields,
          projectMap: requestedFields,
          documentId: new ObjectId(documentId),
          req: context
        },
        {localize: true},
        {
          collection: (schema: Bucket) => this.bds.children(schema),
          preference: () => this.bs.getPreferences(),
          schema: (bucketId: string) => this.bs.findOne({_id: new ObjectId(bucketId)}),
          authResolver: this.authResolver
        }
      );

      if (this.hookChangeEmitter) {
        this.hookChangeEmitter.emitChange(
          {
            bucket: bucket._id.toHexString(),
            type: "update"
          },
          documentId,
          previousDocument,
          currentDocument
        );
      }

      return document;
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

      const previousDocument = await this.bds.children(bucket).findOne({_id: documentId});

      const patchedDocument = applyPatch(previousDocument, input);

      await this.validateInput(bucket._id, patchedDocument).catch(error =>
        throwError(error.message, 400)
      );

      const currentDocument = await patchDocument(
        bucket,
        {...patchedDocument, _id: documentId},
        input,
        {req: context},
        {
          collection: bucketId => this.bds.children(bucketId),
          schema: (bucketId: string) => this.bs.findOne({_id: new ObjectId(bucketId)}),
          authResolver: this.authResolver
        },
        {returnDocument: ReturnDocument.AFTER}
      ).catch(error => throwError(error.message, error instanceof ForbiddenException ? 403 : 500));

      if (!currentDocument) {
        return;
      }

      if (this.history && bucket.history) {
        const promise = this.history.createHistory(bucket._id, previousDocument, currentDocument);
      }

      if (this.activity) {
        const _ = insertActivity(
          context,
          Action.PUT,
          bucket._id.toString(),
          documentId,
          this.activity
        );
      }

      const requestedFields = requestedFieldsFromInfo(info);

      const [document] = await findDocuments(
        bucket,
        {
          relationPaths: requestedFields,
          projectMap: requestedFields,
          documentId: currentDocument._id,
          req: context
        },
        {localize: true},
        {
          collection: (schema: Bucket) => this.bds.children(schema),
          preference: () => this.bs.getPreferences(),
          schema: (bucketId: string) => this.bs.findOne({_id: new ObjectId(bucketId)}),
          authResolver: this.authResolver
        }
      );

      if (this.hookChangeEmitter) {
        this.hookChangeEmitter.emitChange(
          {
            bucket: bucket._id.toHexString(),
            type: "update"
          },
          documentId,
          previousDocument,
          currentDocument
        );
      }

      return document;
    };
  }

  delete(bucket: Bucket, authentication = true) {
    return async (
      root: any,
      {_id: documentId}: {[arg: string]: any},
      context: any,
      info: GraphQLResolveInfo
    ): Promise<string> => {
      if (authentication) {
        await this.authenticate(
          context,
          "/bucket/:bucketId/data/:documentId",
          {bucketId: bucket._id, documentId: documentId},
          ["bucket:data:delete"],
          {resourceFilter: false}
        );
      }

      const deletedDocument = await deleteDocument(
        bucket,
        documentId,
        {req: context},
        {
          collection: schema => this.bds.children(schema),
          schema: (bucketId: string) => this.bs.findOne({_id: new ObjectId(bucketId)}),
          authResolver: this.authResolver
        }
      ).catch(error => throwError(error.message, error instanceof ForbiddenException ? 403 : 500));

      if (!deletedDocument) {
        return;
      }

      await clearRelations(this.bs, bucket._id, documentId);

      if (this.history) {
        await this.history.deleteMany({
          document_id: documentId
        });
      }

      if (this.activity) {
        const _ = insertActivity(
          context,
          Action.DELETE,
          bucket._id.toString(),
          documentId,
          this.activity
        );
      }

      if (this.hookChangeEmitter) {
        this.hookChangeEmitter.emitChange(
          {
            bucket: bucket._id.toHexString(),
            type: "delete"
          },
          documentId,
          deletedDocument,
          undefined
        );
      }

      const dependents = getDependents(bucket, deletedDocument);
      for (const [targetBucketId, targetDocIds] of dependents.entries()) {
        const schema = this.buckets.find(bucket => bucket._id.toString() == targetBucketId);

        if (!schema) {
          continue;
        }

        const deleteFn = this.delete(schema, false);

        for (const targetDocId of targetDocIds) {
          await deleteFn(root, {_id: targetDocId}, context, info);

          if (this.activity) {
            const _ = insertActivity(
              context,
              Action.DELETE,
              targetBucketId,
              targetDocId,
              this.activity
            );
          }
        }
      }

      return "";
    };
  }

  validateInput(bucketId: ObjectId, input: BucketDocument): Promise<any> {
    const validatorMixin = Schema.validate(bucketId.toHexString());
    const pipe: any = new validatorMixin(this.validator);

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
