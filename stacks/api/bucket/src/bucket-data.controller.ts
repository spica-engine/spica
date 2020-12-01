import {
  BadRequestException,
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
  UseInterceptors
} from "@nestjs/common";
import {activity} from "@spica-server/activity/services";
import {HistoryService} from "@spica-server/bucket/history";
import {ChangeEmitter} from "@spica-server/bucket/hooks";
import {BucketDocument, BucketService} from "@spica-server/bucket/services";
import {ARRAY, BOOLEAN, BooleanCheck, DEFAULT, JSONP, JSONPR, NUMBER, OR} from "@spica-server/core";
import {Schema, Validator} from "@spica-server/core/schema";
import {ObjectId, OBJECT_ID} from "@spica-server/database";
import {ActionGuard, AuthGuard, ResourceFilter} from "@spica-server/passport/guard";
import {createBucketDataActivity} from "./activity.resource";
import {BucketDataService} from "./bucket-data.service";
import {applyPatch} from "./patch";
import {clearRelations, createHistory, filterReviver, getRelationPaths} from "./relation";
import {
  findDocuments,
  insertDocument,
  replaceDocument,
  patchDocument,
  deleteDocument
} from "./crud";
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
    @Optional() private changeEmitter: ChangeEmitter,
    @Optional() private history: HistoryService
  ) {}

  /**
   * Returns documents in the bucket.
   * If the documents have translations, `accept-language` header will be taken into account.
   * See: https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Accept-Language
   * @param bucketId Identifier of the bucket.
   * @param acceptedLanguage Documents that have translations are present in this language.
   * @param relation When true, relations in the documents will be replaced with the related document in the response.
   * @param localize When true, documents that have translations is localized to `accept-language`.
   * @param schedule When true, only scheduled documents is present.
   * @param filter A JSON string that has conditions to filter documents. Example: `{"name": "James"}` OR `{"age": {$gt: 35}}`
   * @param paginate When true, a meta property that contains the total number of documents are present.
   * @param limit The maximum amount documents that can be present in the response.
   * @param skip The amount of documents to skip.
   * @param sort A JSON string to sort the documents by its properties.
   * Example: Descending `{"name": -1}` OR Ascending `{"name": 1}`
   */
  @Get()
  @UseGuards(AuthGuard(), ActionGuard("bucket:data:index"))
  async find(
    @Param("bucketId", OBJECT_ID) bucketId: ObjectId,
    @ResourceFilter() resourceFilter: object,
    @Req() req: any,
    @Headers("accept-language") acceptedLanguage?: string,
    @Query("relation", DEFAULT(false), OR(BooleanCheck, BOOLEAN, ARRAY(String)))
    relation?: boolean | string[],
    @Query("paginate", DEFAULT(false), BOOLEAN) paginate?: boolean,
    @Query("schedule", DEFAULT(false), BOOLEAN) schedule?: boolean,
    @Query("localize", DEFAULT(true), BOOLEAN) localize?: boolean,
    @Query("filter", JSONPR(filterReviver)) filter?: object,
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
        paginate,
        schedule
      },
      {
        collection: (bucketId: string) => this.bds.children(bucketId),
        preference: () => this.bs.getPreferences(),
        schema: (bucketId: string) => this.bs.findOne({_id: new ObjectId(bucketId)})
      }
    );
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
  @UseGuards(AuthGuard(), ActionGuard("bucket:data:show"))
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

    const relationPaths: string[][] = getRelationPaths(
      relation == true ? schema : Array.isArray(relation) ? relation : []
    );

    const [document] = await findDocuments(
      schema,
      {
        relationPaths,
        language: acceptedLanguage,
        limit: 1,
        filter: {_id: documentId},
        req,
        projectMap: []
      },
      {
        localize
      },
      {
        collection: (bucketId: string) => this.bds.children(bucketId),
        preference: () => this.bs.getPreferences(),
        schema: (bucketId: string) => this.bs.findOne({_id: new ObjectId(bucketId)})
      }
    );

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
  @UseInterceptors(activity(createBucketDataActivity))
  @Post()
  @UseGuards(AuthGuard(), ActionGuard("bucket:data:create"))
  async insertOne(
    @Req() req,
    @Param("bucketId", OBJECT_ID) bucketId: ObjectId,
    @Body(Schema.validate(req => req.params.bucketId)) rawDocument: BucketDocument
  ) {
    const schema = await this.bs.findOne({_id: bucketId});

    const document = await insertDocument(
      schema,
      rawDocument,
      {req: req},
      {
        collection: bucketId => this.bds.children(bucketId),
        schema: (bucketId: string) => this.bs.findOne({_id: new ObjectId(bucketId)})
      }
    );

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
  @UseInterceptors(activity(createBucketDataActivity))
  @Put(":documentId")
  @UseGuards(AuthGuard(), ActionGuard("bucket:data:update"))
  async replace(
    @Req() req,
    @Param("bucketId", OBJECT_ID) bucketId: ObjectId,
    @Param("documentId", OBJECT_ID) documentId: ObjectId,
    @Body(Schema.validate(req => req.params.bucketId)) document: BucketDocument
  ) {
    const schema = await this.bs.findOne({_id: bucketId});

    const previousDocument = await replaceDocument(
      schema,
      {...document, _id: documentId},
      {req: req},
      {
        collection: bucketId => this.bds.children(bucketId),
        schema: (bucketId: string) => this.bs.findOne({_id: new ObjectId(bucketId)})
      }
    );

    if (!previousDocument) {
      return;
    }

    const currentDocument = {...document, _id: documentId};

    await createHistory(this.bs, this.history, bucketId, previousDocument, currentDocument);

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
  @UseInterceptors(activity(createBucketDataActivity))
  @Patch(":documentId")
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AuthGuard(), ActionGuard("bucket:data:update"))
  async patch(
    @Req() req,
    @Param("bucketId", OBJECT_ID) bucketId: ObjectId,
    @Param("documentId", OBJECT_ID) documentId: ObjectId,
    @Body() patch: Partial<BucketDocument>
  ) {
    const schema = await this.bs.findOne({_id: bucketId});

    const bkt = this.bds.children(bucketId);

    const previousDocument = await bkt.findOne({_id: documentId});

    const patchedDocument = applyPatch(previousDocument, patch);

    await this.validator.validate({$ref: bucketId.toString()}, patchedDocument).catch(error => {
      throw new BadRequestException(
        error.errors
          ? error.errors
              .map(e => {
                const dataPath = e.dataPath.replace(/\//g, ".");
                return `${dataPath} ${e.message}`;
              })
              .join("\n")
          : [],
        error.message
      );
    });

    const currentDocument = await patchDocument(
      schema,
      {...patchedDocument, _id: documentId},
      patch,
      {req: req},
      {
        collection: bucketId => this.bds.children(bucketId),
        schema: (bucketId: string) => this.bs.findOne({_id: new ObjectId(bucketId)})
      },
      {returnOriginal: false}
    );

    if (!currentDocument) {
      return;
    }

    await createHistory(this.bs, this.history, bucketId, previousDocument, currentDocument);

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
  @UseInterceptors(activity(createBucketDataActivity))
  @Delete(":documentId")
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AuthGuard(), ActionGuard("bucket:data:delete"))
  async deleteOne(
    @Req() req,
    @Param("bucketId", OBJECT_ID) bucketId: ObjectId,
    @Param("documentId", OBJECT_ID) documentId: ObjectId
  ) {
    const schema = await this.bs.findOne({_id: bucketId});

    const deletedDocument = await deleteDocument(
      schema,
      documentId,
      {req: req},
      {
        collection: bucketId => this.bds.children(bucketId),
        schema: (bucketId: string) => this.bs.findOne({_id: new ObjectId(bucketId)})
      }
    );

    if (!deletedDocument) {
      return;
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
  }
}
