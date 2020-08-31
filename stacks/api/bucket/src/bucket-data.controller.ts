import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  InternalServerErrorException,
  NotFoundException,
  Optional,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
  UseInterceptors
} from "@nestjs/common";
import {activity} from "@spica-server/activity/services";
import {DataChangeEmitter} from "@spica-server/bucket/change";
import {HistoryService} from "@spica-server/bucket/history";
import {ActionDispatcher} from "@spica-server/bucket/hooks";
import {BucketDocument, BucketService} from "@spica-server/bucket/services";
import {ARRAY, BOOLEAN, DEFAULT, JSONP, JSONPR, NUMBER} from "@spica-server/core";
import {Schema} from "@spica-server/core/schema";
import {MongoError, ObjectId, OBJECT_ID} from "@spica-server/database";
import {ActionGuard, AuthGuard, ResourceFilter, StrategyType} from "@spica-server/passport/guard";
import {createBucketDataActivity} from "./activity.resource";
import {BucketDataService} from "./bucket-data.service";
import {buildI18nAggregation, findLocale, hasTranslatedProperties, Locale} from "./locale";
import {buildRelationAggregation, filterReviver, findRelations, getUpdateParams} from "./utility";

/**
 * All APIs related to bucket documents.
 * @name data
 */
@Controller("bucket/:bucketId/data")
export class BucketDataController {
  constructor(
    private bs: BucketService,
    private bds: BucketDataService,
    @Optional() private dispatcher: ActionDispatcher,
    @Optional() private history: HistoryService,
    @Optional() private changes: DataChangeEmitter
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
    @StrategyType() strategyType: string,
    @ResourceFilter() resourceFilter: object,
    @Headers() headers: object,
    @Req() req: any,
    @Headers("accept-language") acceptedLanguage?: string,
    @Query("relation", DEFAULT(false), BOOLEAN) relation?: boolean,
    @Query("paginate", DEFAULT(false), BOOLEAN) paginate?: boolean,
    @Query("schedule", DEFAULT(false), BOOLEAN) schedule?: boolean,
    @Query("localize", DEFAULT(true), BOOLEAN) localize?: boolean,
    @Query("filter", JSONPR(filterReviver)) filter?: object,
    @Query("limit", NUMBER) limit?: number,
    @Query("skip", NUMBER) skip?: number,
    @Query("sort", JSONP) sort?: object
  ) {
    let aggregation: unknown[] = [
      resourceFilter,
      {
        $match: {
          _schedule: {
            $exists: schedule
          }
        }
      }
    ];

    const bucket = await this.bs.findOne({_id: bucketId});

    if (!bucket) {
      throw new NotFoundException(`Could not find the bucket with id ${bucketId}`);
    }

    let locale: Locale;

    if (localize && hasTranslatedProperties(bucket.properties)) {
      const preferences = await this.bs.getPreferences();
      locale = findLocale(acceptedLanguage, preferences);
      aggregation.push({
        $replaceWith: buildI18nAggregation("$$ROOT", locale.best, locale.fallback)
      });
      req.res.header("Content-language", locale.best || locale.fallback);
    }

    if (sort) {
      aggregation.push({
        $sort: sort
      });
    }

    if (relation) {
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
    }

    if (typeof filter == "object") {
      aggregation.push({
        $set: {
          _id: {
            $toString: `$_id`
          }
        }
      });

      aggregation.push({$match: filter});
    }

    if (this.dispatcher && strategyType == "APIKEY") {
      const hookAggregation = await this.dispatcher.dispatch(
        {bucket: bucketId.toHexString(), type: "INDEX"},
        headers
      );
      if (Array.isArray(hookAggregation) && hookAggregation.length > 0) {
        aggregation = aggregation.concat(hookAggregation);
      }
    }

    let data: Promise<unknown>;

    if (paginate && !skip && !limit) {
      data = this.bds
        .find(bucketId, aggregation)
        .then(data => ({meta: {total: data.length}, data}));
    } else if (paginate && (skip || limit)) {
      const subAggregation = [];
      if (skip) {
        subAggregation.push({$skip: skip});
      }

      if (limit) {
        subAggregation.push({$limit: limit});
      }
      aggregation.push(
        {
          $facet: {
            meta: [{$count: "total"}],
            data: subAggregation
          }
        },
        {$unwind: "$meta"}
      );
      data = this.bds
        .find(bucketId, aggregation)
        .then(([result]) => (result ? result : {meta: {total: 0}, data: []}));
    } else {
      if (skip) {
        aggregation.push({$skip: skip});
      }

      if (limit) {
        aggregation.push({$limit: limit});
      }

      data = this.bds.find(bucketId, aggregation);
    }
    return data.catch((error: MongoError) =>
      Promise.reject(new InternalServerErrorException(`${error.message}; code ${error.code}.`))
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
    @Headers() headers: object,
    @StrategyType() strategyType: string,
    @Req() req: any,
    @Param("bucketId", OBJECT_ID) bucketId: ObjectId,
    @Param("documentId", OBJECT_ID) documentId: ObjectId,
    @Query("localize", DEFAULT(true), BOOLEAN) localize?: boolean,
    @Query("relation", DEFAULT(false), BOOLEAN) relation?: boolean
  ) {
    let aggregation = [];

    aggregation.push({
      $match: {
        _id: documentId
      }
    });

    let locale: Locale;

    if (localize) {
      const preferences = await this.bs.getPreferences();
      locale = findLocale(acceptedLanguage, preferences);
      aggregation.unshift({
        $replaceWith: buildI18nAggregation("$$ROOT", locale.best, locale.fallback)
      });
      req.res.header("Content-language", locale.best || locale.fallback);
    }

    if (relation) {
      const schema = await this.bs.findOne({_id: bucketId});
      for (const propertyKey in schema.properties) {
        const property = schema.properties[propertyKey];
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
    }

    if (this.dispatcher && strategyType == "APIKEY") {
      const hookAggregation = await this.dispatcher.dispatch(
        {bucket: bucketId.toHexString(), type: "GET"},
        headers,
        documentId.toHexString()
      );
      if (Array.isArray(hookAggregation) && hookAggregation.length > 0) {
        aggregation = aggregation.concat(hookAggregation);
      }
    }

    const [document] = await this.bds.find(bucketId, aggregation);

    if (!document) {
      throw new NotFoundException(`${documentId} could not be found.`);
    }
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
    @Param("bucketId", OBJECT_ID) bucketId: ObjectId,
    @Headers() headers: object,
    @StrategyType() strategyType: string,
    @Body(Schema.validate(req => req.params.bucketId)) body: BucketDocument
  ) {
    if (this.dispatcher && strategyType == "APIKEY") {
      const allowed = await this.dispatcher.dispatch(
        {bucket: bucketId.toHexString(), type: "INSERT"},
        headers
      );
      if (!allowed) {
        throw new ForbiddenException("Forbidden action.");
      }
    }
    const {
      ops: [currentDocument],
      insertedId
    } = await this.bds.insertOne(bucketId, body);

    if (this.changes) {
      this.changes.emitChange(
        {
          bucket: bucketId.toHexString(),
          type: "insert"
        },
        insertedId.toHexString(),
        undefined,
        currentDocument
      );
    }

    return currentDocument;
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
  async update(
    @Param("bucketId", OBJECT_ID) bucketId: ObjectId,
    @Param("documentId", OBJECT_ID) documentId: ObjectId,
    @Headers() headers: object,
    @StrategyType() strategyType: string,
    @Body(Schema.validate(req => req.params.bucketId)) body: BucketDocument
  ) {
    if (this.dispatcher && strategyType == "APIKEY") {
      const allowed = await this.dispatcher.dispatch(
        {bucket: bucketId.toHexString(), type: "UPDATE"},
        headers,
        documentId.toHexString()
      );
      if (!allowed) {
        throw new ForbiddenException("Forbidden action.");
      }
    }

    const {value: previousDocument} = await this.bds.replaceOne(bucketId, {_id: documentId}, body, {
      returnOriginal: true
    });

    const currentDocument = {...body, _id: documentId};
    const _ = this.createHistory(bucketId, previousDocument, currentDocument);

    if (this.changes) {
      this.changes.emitChange(
        {
          bucket: bucketId.toHexString(),
          type: "replace"
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
    @Headers() headers: object,
    @StrategyType() strategyType: string,
    @Param("bucketId", OBJECT_ID) bucketId: ObjectId,
    @Param("documentId", OBJECT_ID) documentId: ObjectId
  ) {
    if (this.dispatcher && strategyType == "APIKEY") {
      const allowed = await this.dispatcher.dispatch(
        {bucket: bucketId.toHexString(), type: "DELETE"},
        headers,
        documentId.toHexString()
      );
      if (!allowed) {
        throw new ForbiddenException("Forbidden action.");
      }
    }

    let deletedDocument: BucketDocument;

    if (this.changes) {
      deletedDocument = await this.bds.findOne(bucketId, {_id: documentId});
    }
    const {deletedCount} = await this.bds.deleteOne(bucketId, {_id: documentId});

    if (deletedCount > 0) {
      if (this.changes) {
        this.changes.emitChange(
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
      await this.clearRelations(this.bs, bucketId, documentId);
    }
  }

  /**
   * Removes one or more documents from the bucket.
   * > Deprecated: This resource is deprecated and will be removed in upcoming releases.
   * @param bucketId Identifier of the bucket.
   * @body ```json
   * [
   *   "identifier_of_the_first_document",
   *   "identifier_of_the_second_document",
   *   "identifier_of_the_last_document"
   * ]
   * ```
   */
  @UseInterceptors(activity(createBucketDataActivity))
  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AuthGuard(), ActionGuard("bucket:data:delete"))
  async deleteMany(
    @StrategyType() strategyType: string,
    @Param("bucketId", OBJECT_ID) bucketId: ObjectId,
    @Body(ARRAY(v => new ObjectId(v))) ids: ObjectId[]
  ) {
    if (strategyType == "APIKEY") {
      throw new BadRequestException(
        "Apikey strategy does not support deleting multiple resource at once."
      );
    }

    let documents: BucketDocument[];

    if (this.changes) {
      documents = await this.bds.find(bucketId, {$match: {_id: {$in: ids}}});
    }
    const {deletedCount} = await this.bds.deleteMany(bucketId, ids);

    if (deletedCount > 0) {
      if (this.changes) {
        for (const document of documents) {
          this.changes.emitChange(
            {bucket: bucketId.toHexString(), type: "delete"},
            document._id.toHexString(),
            document,
            null
          );
        }
      }
      await Promise.all(ids.map(id => this.clearRelations(this.bs, bucketId, id)));
      if (this.history) {
        await Promise.all(ids.map(id => this.history.deleteMany({document_id: id})));
      }
    }
  }

  async clearRelations(bucketService: BucketService, bucketId: ObjectId, documentId: ObjectId) {
    let buckets = await bucketService.find({_id: {$ne: bucketId}});
    if (buckets.length < 1) return;

    for (const bucket of buckets) {
      let targets = findRelations(bucket.properties, bucketId.toHexString(), "", new Map());
      if (targets.size < 1) continue;

      for (const [target, type] of targets.entries()) {
        const updateParams = getUpdateParams(target, type, documentId.toHexString());
        await bucketService
          .collection(`bucket_${bucket._id.toHexString()}`)
          .updateMany(updateParams.filter, updateParams.update);
      }
    }
  }

  createHistory(
    bucketId: ObjectId,
    previousDocument: BucketDocument,
    currentDocument: BucketDocument
  ) {
    return this.bs.findOne({_id: bucketId}).then(bucket => {
      if (bucket && bucket.history) {
        return this.history.createHistory(bucketId, previousDocument, currentDocument);
      }
    });
  }
}
