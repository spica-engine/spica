import {
  ForbiddenException,
  Inject,
  Injectable,
  OnModuleInit,
  Optional,
  PipeTransform
} from "@nestjs/common";
import {HttpAdapterHost} from "@nestjs/core";
import {ActivityService} from "@spica-server/activity-services";
import {HISTORY_REPOSITORY, HistoryRepository} from "@spica-server/interface-bucket-history";
import {ChangeEmitter} from "@spica-server/bucket-hooks";
import {BucketService} from "@spica-server/bucket-services";
import {Schema, Validator} from "@spica-server/core-schema";
import {ids} from "@spica-server/data";
import {Id} from "@spica-server/interface-data";
import {GuardService} from "@spica-server/passport-guard-services";
import {resourceFilterFunction, extractStrategyType} from "@spica-server/passport-guard";
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
import {
  clearRelations,
  getDependents,
  findLocale,
  insertActivity,
  decryptDocumentFields,
  setContentLanguage
} from "@spica-server/bucket-common";
import {
  BUCKET_QUERY,
  BUCKET_WRITE,
  BucketQueryFacade,
  BucketReadContext,
  BucketWriteFacade
} from "@spica-server/interface-bucket-common";
import {FindResponse} from "@spica-server/interface-bucket-graphql";
import {
  Bucket,
  BUCKET_DATA_HASH_SECRET,
  BUCKET_DATA_REPOSITORY,
  BucketDataRepository,
  BucketDocument
} from "@spica-server/interface-bucket";
import {BUCKET_DATA_ENCRYPTION_SECRET} from "@spica-server/interface-bucket";
import {ReqAuthStrategy} from "@spica-server/interface-passport-guard";

import {
  createSchema,
  extractAggregationFromQuery,
  getBucketName,
  requestedFieldsFromExpression,
  requestedFieldsFromInfo,
  validateBuckets
} from "./schema.js";
import {applyPatch, deepCopy} from "@spica-server/core-patch";
import {Action} from "@spica-server/interface-activity";
import {SchemaWarning} from "@spica-server/interface-bucket-graphql";

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
        return ids().unscoped().parse(value);
      },
      serialize(value) {
        return value.toString();
      },
      parseLiteral(ast: ValueNode) {
        const value = ast["value"];
        if (ids().unscoped().isValid(value)) {
          return ids().unscoped().parse(value);
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
    @Inject(BUCKET_DATA_REPOSITORY) private bucketData: BucketDataRepository,
    private guardService: GuardService,
    private validator: Validator,
    @Inject(BUCKET_QUERY) private queries: BucketQueryFacade,
    @Inject(BUCKET_WRITE) private writes: BucketWriteFacade,
    @Optional() private activity: ActivityService,
    @Optional() @Inject(HISTORY_REPOSITORY) private history: HistoryRepository,
    @Optional() private hookChangeEmitter: ChangeEmitter,
    @Optional() @Inject(BUCKET_DATA_HASH_SECRET) private hashSecret?: string,
    @Optional() @Inject(BUCKET_DATA_ENCRYPTION_SECRET) private encryptionSecret?: string
  ) {
    this.bs.schemaChangeEmitter.subscribe(() => {
      this.bs.findAll().then(buckets => {
        this.schemaWarnings = [];

        if (!buckets.length) {
          this.schema = this.defaultSchema;
          return;
        }

        const result = validateBuckets(buckets);
        this.buckets = result.buckets;
        this.schemaWarnings = result.warnings;

        this.schema = this.getSchema(this.buckets);
      });
    });
  }

  onModuleInit() {
    const app = this.adapterHost.httpAdapter.getInstance();

    app.use(
      "/graphql",
      graphqlHTTP(async (request, response, gqlParams) => {
        await this.authenticate(request, response);

        await this.authorize(request, "/bucket", {}, ["bucket:index"], {
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
      await this.authorize(
        context,
        "/bucket/:bucketId/data",
        {bucketId: bucket._id},
        ["bucket:data:index"],
        {resourceFilter: false}
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

      const {result, locale} = await this.queries.paginate<BucketDocument>(
        bucket,
        {
          language,
          localize: true,
          user: context.user,
          limit,
          skip,
          sort,
          relationPaths: [...expressionFields, ...responseFields],
          filter: matchExpression,
          projectMap: responseFields,
          applyAcl: this.shouldApplyAcl(context)
        },
        this.bucketContext()
      );
      setContentLanguage(context, locale);
      return result;
    };
  }

  findById(bucket: Bucket): Function {
    return async (
      root: any,
      {_id: documentId, language}: {[arg: string]: any},
      context: any,
      info: GraphQLResolveInfo
    ): Promise<BucketDocument> => {
      await this.authorize(
        context,
        "/bucket/:bucketId/data",
        {bucketId: bucket._id},
        ["bucket:data:show"],
        {resourceFilter: false}
      );

      // The ObjectId scalar turns an invalid literal into null, which has always read as not found.
      if (documentId == null) {
        return null;
      }

      const requestedFields = requestedFieldsFromInfo(info);

      const {result: document, locale} = await this.queries.findOne<BucketDocument>(
        bucket,
        {
          language,
          localize: true,
          user: context.user,
          relationPaths: requestedFields,
          projectMap: requestedFields,
          documentId: (await ids().forBucket(bucket._id.toString())).parse(documentId),
          applyAcl: this.shouldApplyAcl(context)
        },
        {
          ...this.bucketContext(),
          resolveSchema: (bucketId: string) =>
            Promise.resolve(this.buckets.find(b => b._id.toString() == bucketId))
        }
      );
      setContentLanguage(context, locale);

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
      await this.authorize(
        context,
        "/bucket/:bucketId/data",
        {bucketId: bucket._id},
        ["bucket:data:create"],
        {resourceFilter: false}
      );

      await this.validateInput(bucket._id, input).catch(error => throwError(error.message, 400));

      const insertedDocument = await this.writes
        .insert(
          bucket,
          input,
          {applyAcl: this.shouldApplyAcl(context), user: context.user},
          {
            ...this.bucketContext(),
            deleteOne: async documentId => {
              const deleteFn = this.delete(bucket, false);
              await deleteFn(root, {_id: documentId}, context, info);
            }
          }
        )
        .catch(error => throwError(error.message, error instanceof ForbiddenException ? 403 : 500));
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

      const {result: document, locale} = await this.queries.findOne<BucketDocument>(
        bucket,
        {
          localize: true,
          user: context.user,
          relationPaths: requestedFields,
          projectMap: requestedFields,
          documentId: insertedDocument._id,
          applyAcl: this.shouldApplyAcl(context)
        },
        this.bucketContext()
      );
      setContentLanguage(context, locale);

      if (this.hookChangeEmitter) {
        this.hookChangeEmitter.emitChange(
          {
            bucket: bucket._id.toString(),
            type: "insert"
          },
          document._id.toString(),
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
      await this.authorize(
        context,
        "/bucket/:bucketId/data",
        {bucketId: bucket._id},
        ["bucket:data:update"],
        {resourceFilter: false}
      );

      await this.validateInput(bucket._id, input).catch(error => throwError(error.message, 400));

      const previousDocument = await this.writes
        .replace(
          bucket,
          {...input, _id: documentId},
          {applyAcl: this.shouldApplyAcl(context), user: context.user},
          this.bucketContext()
        )
        .catch(error => throwError(error.message, error instanceof ForbiddenException ? 403 : 500));

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

      const {result: document, locale} = await this.queries.findOne<BucketDocument>(
        bucket,
        {
          localize: true,
          user: context.user,
          relationPaths: requestedFields,
          projectMap: requestedFields,
          documentId: (await ids().forBucket(bucket._id.toString())).parse(documentId),
          applyAcl: this.shouldApplyAcl(context)
        },
        this.bucketContext()
      );
      setContentLanguage(context, locale);

      if (this.hookChangeEmitter) {
        this.hookChangeEmitter.emitChange(
          {
            bucket: bucket._id.toString(),
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
      await this.authorize(
        context,
        "/bucket/:bucketId/data",
        {bucketId: bucket._id},
        ["bucket:data:update"],
        {resourceFilter: false}
      );

      let previousDocument = await this.bucketData.findById(bucket, documentId);
      if (this.encryptionSecret) {
        previousDocument = decryptDocumentFields(
          previousDocument,
          bucket,
          this.encryptionSecret,
          this.bs.resolveSchema
        );
      }

      const patchedDocument = applyPatch(previousDocument, input);

      await this.validateInput(bucket._id, patchedDocument).catch(error =>
        throwError(error.message, 400)
      );

      const currentDocument = await this.writes
        .patch(
          bucket,
          {...patchedDocument, _id: documentId},
          input,
          {applyAcl: this.shouldApplyAcl(context), user: context.user, returnDocument: "after"},
          this.bucketContext()
        )
        .catch(error => throwError(error.message, error instanceof ForbiddenException ? 403 : 500));

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

      const {result: document, locale} = await this.queries.findOne<BucketDocument>(
        bucket,
        {
          localize: true,
          user: context.user,
          relationPaths: requestedFields,
          projectMap: requestedFields,
          documentId: currentDocument._id,
          applyAcl: this.shouldApplyAcl(context)
        },
        this.bucketContext()
      );
      setContentLanguage(context, locale);

      if (this.hookChangeEmitter) {
        this.hookChangeEmitter.emitChange(
          {
            bucket: bucket._id.toString(),
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
        await this.authorize(
          context,
          "/bucket/:bucketId/data",
          {bucketId: bucket._id},
          ["bucket:data:delete"],
          {resourceFilter: false}
        );
      }

      const deletedDocument = await this.writes
        .delete(
          bucket,
          documentId,
          {applyAcl: this.shouldApplyAcl(context), user: context.user},
          this.bucketContext()
        )
        .catch(error => throwError(error.message, error instanceof ForbiddenException ? 403 : 500));

      if (!deletedDocument) {
        return;
      }

      await clearRelations(this.bs, this.bucketData, bucket._id, documentId);

      if (this.history) {
        await this.history.deleteByDocument(documentId);
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
            bucket: bucket._id.toString(),
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

  validateInput(bucketId: Id, input: BucketDocument): Promise<any> {
    const validatorMixin = Schema.validate(bucketId.toString());
    const pipe: any = new validatorMixin(this.validator);

    return pipe.transform(input);
  }

  async authenticate(req: any, res: any) {
    await this.guardService
      .checkAuthentication({
        request: req,
        response: res
      })
      .catch(error => {
        throwError(error.message, 401);
      });
  }

  async authorize(
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
      .checkAuthorization({
        request: req,
        response: {},
        actions: actions,
        options: options
      })
      .catch(error => {
        throwError(error.message, 403);
      });
    if (options.resourceFilter) {
      return resourceFilterFunction({collection: "buckets"}, {
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

  private bucketContext(): BucketReadContext {
    return {
      resolveSchema: this.bs.resolveSchema,
      preferences: () => this.bs.getPreferences(),
      hashSecret: this.hashSecret,
      encryptionSecret: this.encryptionSecret
    };
  }

  private shouldApplyAcl(req: any): boolean {
    const strategyType = extractStrategyType(req);
    return strategyType === ReqAuthStrategy.USER;
  }
}

function throwError(message: string, statusCode: number) {
  throw new GraphQLError(message, null, null, null, null, null, {
    statusCode: statusCode
  });
}
