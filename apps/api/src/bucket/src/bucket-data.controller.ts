import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Optional,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
  Inject,
  HttpException
} from "@nestjs/common";
import {activity, ActivityService, createActivity} from "@spica-server/activity/services";
import {HistoryService} from "@spica-server/bucket/history";
import {ChangeEmitter} from "@spica-server/bucket/hooks";
import {BucketDataService, BucketService} from "@spica-server/bucket/services";
import {
  ARRAY,
  BOOLEAN,
  BooleanCheck,
  DEFAULT,
  JSONP,
  JSONPR,
  NUMBER,
  OR,
  EXPRESSION
} from "@spica-server/core";
import {Schema, Validator} from "@spica-server/core/schema";
import {ObjectId, OBJECT_ID, ReturnDocument} from "@spica-server/database";
import {ActionGuard, AuthGuard, ResourceFilter} from "@spica-server/passport/guard";
import {invalidateCache, registerCache} from "@spica-server/bucket/cache";
import {
  deleteDocument,
  findDocuments,
  insertDocument,
  patchDocument,
  replaceDocument,
  authIdToString,
  isJSONFilter,
  filterReviver
} from "@spica-server/bucket/common";
import {expressionFilterParser} from "./filter";
import {
  clearRelations,
  getRelationPaths,
  getDependents,
  createBucketDataActivity
} from "@spica-server/bucket/common";
import {applyPatch} from "@spica-server/core/patch";
import {IAuthResolver, AUTH_RESOLVER} from "@spica-server/interface/bucket/common";
import {BucketDocument} from "@spica-server/interface/bucket";
import {BUCKET_DATA_HASHING_KEY} from "@spica-server/interface/bucket";

/**
 * All APIs related to bucket documents.
 * @name data
 */
@Controller("bucket/:bucketId/data")
export class BucketDataController {
  constructor(
    private bs: BucketService,
    private bds: BucketDataService,
    private validator: Validator,
    @Inject(AUTH_RESOLVER) private authResolver: IAuthResolver,
    @Optional() private changeEmitter: ChangeEmitter,
    @Optional() private history: HistoryService,
    @Optional() @Inject() private activityService: ActivityService,
    @Optional() @Inject(BUCKET_DATA_HASHING_KEY) private hashingKey?: string
  ) {}

  /**
   * Returns documents in the bucket.
   * If the documents have translations, `accept-language` header will be taken into account.
   * See: https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Accept-Language
   * @param bucketId Identifier of the bucket.
   * @param acceptedLanguage Documents that have translations are present in this language.
   * @param relation When true, relations in the documents will be replaced with the related document in the response.
   * @param localize When true, documents that have translations is localized to `accept-language`.
   * @param filter An expression to filter documents. Example: `name == James" `, `age > 35`, `age > 35 && age < 50`, `gender == "F" && age > 20`
   * @param paginate When true, a meta property that contains the total number of documents is present.
   * @param limit The maximum amount documents that can be present in the response.
   * @param skip The amount of documents to skip.
   * @param sort A JSON string to sort the documents by its properties.
   * Example: Descending `{"name": -1}` OR Ascending `{"name": 1}`
   */
  @Get()
  @UseInterceptors(registerCache())
  @UseGuards(AuthGuard(), ActionGuard("bucket:data:index", undefined, authIdToString))
  async find(
    @Param("bucketId", OBJECT_ID) bucketId: ObjectId,
    @ResourceFilter() resourceFilter: object,
    @Req() req: any,
    @Headers("accept-language") acceptedLanguage?: string,
    @Query("relation", DEFAULT(false), OR(BooleanCheck, BOOLEAN, ARRAY(String)))
    relation?: boolean | string[],
    @Query("paginate", DEFAULT(false), BOOLEAN) paginate?: boolean,
    @Query("localize", DEFAULT(true), BOOLEAN) localize?: boolean,
    @Query("filter", OR(isJSONFilter, JSONPR(filterReviver), EXPRESSION(expressionFilterParser)))
    filter?: string | object,
    @Query("limit", NUMBER) limit?: number,
    @Query("skip", NUMBER) skip?: number,
    @Query("sort", JSONP) sort?: object
  ) {
    const schema = await this.bs.findOne({_id: bucketId});

    if (!schema) {
      throw new NotFoundException(`Could not find the schema with id ${bucketId}`);
    }

    const relationPaths: string[][] = getRelationPaths(
      relation == true ? schema : Array.isArray(relation) ? relation : []
    );

    return findDocuments(
      schema,
      {
        resourceFilter,
        relationPaths,
        language: acceptedLanguage,
        filter,
        limit,
        skip,
        sort,
        req,
        projectMap: []
      },
      {
        localize,
        paginate
      },
      {
        collection: schema => this.bds.children(schema),
        preference: () => this.bs.getPreferences(),
        schema: (bucketId: string) => this.bs.findOne({_id: new ObjectId(bucketId)}),
        authResolver: this.authResolver
      },
      this.hashingKey
    ).catch(this.errorHandler);
  }

  @Get("profile")
  @UseGuards(AuthGuard(), ActionGuard("bucket:data:profile", "bucket/:bucketId/data"))
  async findProfileEntries(
    @Param("bucketId", OBJECT_ID) bucketId: ObjectId,
    @Query("filter", JSONPR(filterReviver)) filter?: object,
    @Query("limit", NUMBER) limit?: number,
    @Query("skip", NUMBER) skip?: number,
    @Query("sort", JSONP) sort?: {[key: string]: 1 | -1}
  ) {
    const schema = await this.bs.findOne({_id: bucketId});

    if (!schema) {
      throw new NotFoundException(`Could not find the schema with id ${bucketId}`);
    }
    const cursor = this.bds.children(schema).findOnProfiler(filter);

    if (limit) {
      cursor.limit(limit);
    }

    if (skip) {
      cursor.skip(skip);
    }

    if (sort) {
      cursor.sort(sort);
    }

    return cursor.toArray();
  }

  /**
   * Return the document.
   * If the document has translations, `accept-language` header will be taken into account.
   * See: https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Accept-Language
   * @param bucketId Identifier of the bucket.
   * @param documentId Identifier of the document in the bucket.
   * @param acceptedLanguage Documents that have translations are present in this language.
   * @param relation When true, relations in the documents will be replaced with the related document in the response.
   * @param localize When true, documents that have translations is localized to `accept-language`.
   */
  @Get(":documentId")
  @UseInterceptors(registerCache())
  @UseGuards(AuthGuard(), ActionGuard("bucket:data:show", undefined, authIdToString))
  async findOne(
    @Headers("accept-language") acceptedLanguage: string,
    @Req() req: any,
    @Param("bucketId", OBJECT_ID) bucketId: ObjectId,
    @Param("documentId", OBJECT_ID) documentId: ObjectId,
    @Query("localize", DEFAULT(true), BOOLEAN) localize?: boolean,
    @Query("relation", DEFAULT(false), OR(BooleanCheck, BOOLEAN, ARRAY(String)))
    relation?: boolean | string[]
  ) {
    const schema = await this.bs.findOne({_id: bucketId});

    if (!schema) {
      throw new NotFoundException(`Could not find the schema with id ${bucketId}`);
    }

    const relationPaths: string[][] = getRelationPaths(
      relation == true ? schema : Array.isArray(relation) ? relation : []
    );

    const [document]: any = await findDocuments(
      schema,
      {
        relationPaths,
        language: acceptedLanguage,
        limit: 1,
        documentId: documentId,
        req,
        projectMap: []
      },
      {
        localize
      },
      {
        collection: schema => this.bds.children(schema),
        preference: () => this.bs.getPreferences(),
        schema: (bucketId: string) => this.bs.findOne({_id: new ObjectId(bucketId)}),
        authResolver: this.authResolver
      },
      this.hashingKey
    ).catch(this.errorHandler);

    return document;
  }

  /**
   * Adds a new document into the bucket. Keep in mind that the document in the body has to match schema of the bucket.
   * @param bucketId Identifier of the bucket.
   * @body
   * ##### When the bucket has no translated property body looks like below
   * ```json
   * {
   *    "name": "The Great Gatsby",
   *    "writer": "F. Scott Fitzgerald",
   *    "written_at": "1925",
   * }
   * ```
   * ##### Otherwise, when there is a translated property, for instance the `name` property has to be like below
   * ```json
   * {
   *    "name": {
   *      "tr_TR": "Muhteşem Gatsby",
   *      "en_US": "The Great Gatsby"
   *    },
   *    "writer": "F. Scott Fitzgerald",
   *    "written_at": "1925",
   * }
   * ```
   */
  @UseInterceptors(activity(createBucketDataActivity), invalidateCache())
  @Post()
  @UseGuards(AuthGuard(), ActionGuard("bucket:data:create"))
  async insertOne(
    @Req() req,
    @Param("bucketId", OBJECT_ID) bucketId: ObjectId,
    @Body(Schema.validate(req => req.params.bucketId)) rawDocument: BucketDocument
  ) {
    const schema = await this.bs.findOne({_id: bucketId});

    if (!schema) {
      throw new NotFoundException(`Could not find the schema with id ${bucketId}`);
    }

    const document = await insertDocument(
      schema,
      rawDocument,
      {req: req},
      {
        collection: schema => this.bds.children(schema),
        schema: (bucketId: string) => this.bs.findOne({_id: new ObjectId(bucketId)}),
        deleteOne: documentId => this.deleteOne(req, bucketId, documentId),
        authResolver: this.authResolver
      }
    ).catch(this.errorHandler);

    if (!document) {
      return;
    }

    if (this.changeEmitter) {
      this.changeEmitter.emitChange(
        {
          bucket: bucketId.toHexString(),
          type: "insert"
        },
        document._id.toHexString(),
        undefined,
        document
      );
    }

    return document;
  }

  /**
   * Replaces a document in the bucket.
   * @param bucketId Identifier of the bucket.
   * @param documentId Identifier of the document.
   * @body
   * ```json
   * {
   *    "name": "Lucifer",
   *    "age": 35,
   *    "famous": true,
   *    "role": "Actor"
   * }
   * ```
   */
  @UseInterceptors(activity(createBucketDataActivity), invalidateCache())
  @Put(":documentId")
  @UseGuards(AuthGuard(), ActionGuard("bucket:data:update"))
  async replace(
    @Req() req,
    @Param("bucketId", OBJECT_ID) bucketId: ObjectId,
    @Param("documentId", OBJECT_ID) documentId: ObjectId,
    @Body(Schema.validate(req => req.params.bucketId)) document: BucketDocument
  ) {
    const schema = await this.bs.findOne({_id: bucketId});

    if (!schema) {
      throw new NotFoundException(`Could not find the schema with id ${bucketId}`);
    }

    const previousDocument = await replaceDocument(
      schema,
      {...document, _id: documentId},
      {req: req},
      {
        collection: schema => this.bds.children(schema),
        schema: (bucketId: string) => this.bs.findOne({_id: new ObjectId(bucketId)}),
        authResolver: this.authResolver
      }
    ).catch(this.errorHandler);

    if (!previousDocument) {
      throw new NotFoundException(`Could not find the document with id ${documentId}`);
    }

    const currentDocument = {...document, _id: documentId};

    if (this.history && schema.history) {
      await this.history.createHistory(bucketId, previousDocument, currentDocument);
    }

    if (this.changeEmitter) {
      this.changeEmitter.emitChange(
        {
          bucket: bucketId.toHexString(),
          type: "update"
        },
        documentId.toHexString(),
        previousDocument,
        currentDocument
      );
    }

    return currentDocument;
  }

  /**
   * Update a document in the bucket.
   * Body should be in format of JSON merge patch.
   * @param bucketId Identifier of the bucket.
   * @param documentId Identifier of the document.
   * @body
   * ```json
   * {
   *    "name": "Daniel",
   *    "age": null
   * }
   * ```
   */
  @UseInterceptors(activity(createBucketDataActivity), invalidateCache())
  @Patch(":documentId")
  @UseGuards(AuthGuard(), ActionGuard("bucket:data:update"))
  async patch(
    @Req() req,
    @Param("bucketId", OBJECT_ID) bucketId: ObjectId,
    @Param("documentId", OBJECT_ID) documentId: ObjectId,
    @Body() patch: Partial<BucketDocument>
  ) {
    const schema = await this.bs.findOne({_id: bucketId});

    if (!schema) {
      throw new NotFoundException(`Could not find the schema with id ${bucketId}`);
    }

    const bkt = this.bds.children(schema);

    const previousDocument = await bkt.findOne({_id: documentId});

    if (!previousDocument) {
      throw new NotFoundException(`Could not find the document with id ${documentId}`);
    }

    const patchedDocument = applyPatch(previousDocument, patch);

    await this.validateDocument(bucketId, patchedDocument);

    const currentDocument = await patchDocument(
      schema,
      {...patchedDocument, _id: documentId},
      patch,
      {req: req},
      {
        collection: schema => this.bds.children(schema),
        schema: (bucketId: string) => this.bs.findOne({_id: new ObjectId(bucketId)}),
        authResolver: this.authResolver
      },
      {returnDocument: ReturnDocument.AFTER}
    ).catch(this.errorHandler);

    if (!currentDocument) {
      throw new NotFoundException(`Could not find the document with id ${documentId}`);
    }

    if (this.history && schema.history) {
      await this.history.createHistory(bucketId, previousDocument, currentDocument);
    }

    if (this.changeEmitter) {
      this.changeEmitter.emitChange(
        {
          bucket: bucketId.toHexString(),
          type: "update"
        },
        documentId.toHexString(),
        previousDocument,
        currentDocument
      );
    }

    return currentDocument;
  }

  /**
   * Removes a document from the bucket.
   * @param bucketId Identifier of the bucket.
   * @param documentId Identifier of the document.
   */
  @UseInterceptors(activity(createBucketDataActivity), invalidateCache())
  @Delete(":documentId")
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AuthGuard(), ActionGuard("bucket:data:delete"))
  async deleteOne(
    @Req() req,
    @Param("bucketId", OBJECT_ID) bucketId: ObjectId,
    @Param("documentId", OBJECT_ID) documentId: ObjectId
  ) {
    const schema = await this.bs.findOne({_id: bucketId});

    if (!schema) {
      throw new NotFoundException(`Could not find the schema with id ${bucketId}`);
    }

    const deletedDocument = await deleteDocument(
      schema,
      documentId,
      {req: req},
      {
        collection: schema => this.bds.children(schema),
        schema: (bucketId: string) => this.bs.findOne({_id: new ObjectId(bucketId)}),
        authResolver: this.authResolver
      }
    ).catch(this.errorHandler);

    if (!deletedDocument) {
      throw new NotFoundException(`Could not find the document with id ${documentId}`);
    }

    if (this.changeEmitter) {
      this.changeEmitter.emitChange(
        {
          bucket: bucketId.toHexString(),
          type: "delete"
        },
        documentId.toHexString(),
        deletedDocument,
        undefined
      );
    }

    if (this.history) {
      await this.history.deleteMany({
        document_id: documentId
      });
    }

    await clearRelations(this.bs, bucketId, documentId);

    const dependents = getDependents(schema, deletedDocument);

    for (const [targetBucketId, targetDocIds] of dependents.entries()) {
      for (const targetDocId of targetDocIds) {
        await this.deleteOne(req, new ObjectId(targetBucketId), new ObjectId(targetDocId));

        if (this.activityService) {
          const activities = createActivity(req, {body: []}, createBucketDataActivity);

          if (activities.length) {
            await this.activityService.insert(activities);
          }
        }
      }
    }
  }

  errorHandler(error: {status: number; message: string}) {
    throw new HttpException(error.message, error.status || 500);
  }

  validateDocument(bucketId: ObjectId, document: BucketDocument): Promise<void> {
    const validatorMixin = Schema.validate(bucketId.toHexString());
    const pipe: any = new validatorMixin(this.validator);
    return pipe.transform(document);
  }
}
