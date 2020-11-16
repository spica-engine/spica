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
  UseInterceptors,
  Patch,
  UseGuards,
  PipeTransform
} from "@nestjs/common";
import {activity} from "@spica-server/activity/services";
import {HistoryService} from "@spica-server/bucket/history";
import {ChangeEmitter, ReviewDispatcher} from "@spica-server/bucket/hooks";
import {BucketDocument, BucketService} from "@spica-server/bucket/services";
import {Schema, Validator} from "@spica-server/core/schema";
import {ARRAY, BOOLEAN, DEFAULT, JSONP, JSONPR, NUMBER, OR, BooleanCheck} from "@spica-server/core";
import {MongoError, ObjectId, OBJECT_ID} from "@spica-server/database";
import {ActionGuard, AuthGuard, ResourceFilter, StrategyType} from "@spica-server/passport/guard";
import {createBucketDataActivity} from "./activity.resource";
import {BucketDataService} from "./bucket-data.service";
import {buildI18nAggregation, findLocale, hasTranslatedProperties, Locale} from "./locale";
import {
  buildRelationAggregation,
  filterReviver,
  clearRelations,
  createHistory,
  getRelationAggregation,
  getPatchedDocument,
  updateQueryForPatch
} from "./utility";

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
    @Optional() private reviewDispatcher: ReviewDispatcher,
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
    @StrategyType() strategyType: string,
    @ResourceFilter() resourceFilter: object,
    @Headers() headers: object,
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
      if (typeof relation == "boolean") {
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
      } else {
        let fields: string[][] = relation.map(pattern => pattern.split("."));

        let relationAggregation = await getRelationAggregation(
          bucket.properties,
          fields,
          locale,
          (bucketId: string) => this.bs.findOne({_id: new ObjectId(bucketId)})
        );

        aggregation.push(...relationAggregation);
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

    if (this.reviewDispatcher && strategyType == "APIKEY") {
      const hookAggregation = await this.reviewDispatcher.dispatch(
        {bucket: bucketId.toHexString(), type: "index"},
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
    @Query("relation", DEFAULT(false), OR(BooleanCheck, BOOLEAN, ARRAY(String)))
    relation?: boolean | string[]
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
      const bucket = await this.bs.findOne({_id: bucketId});
      if (typeof relation == "boolean") {
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
      } else {
        let fields: string[][] = relation.map(pattern => pattern.split("."));

        let relationAggregation = await getRelationAggregation(
          bucket.properties,
          fields,
          locale,
          (bucketId: string) => this.bs.findOne({_id: new ObjectId(bucketId)})
        );

        aggregation.push(...relationAggregation);
      }
    }

    if (this.reviewDispatcher && strategyType == "APIKEY") {
      const hookAggregation = await this.reviewDispatcher.dispatch(
        {bucket: bucketId.toHexString(), type: "get"},
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
    if (this.reviewDispatcher && strategyType == "APIKEY") {
      const allowed = await this.reviewDispatcher.dispatch(
        {bucket: bucketId.toHexString(), type: "insert"},
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

    if (this.changeEmitter) {
      this.changeEmitter.emitChange(
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
    if (this.reviewDispatcher && strategyType == "APIKEY") {
      const allowed = await this.reviewDispatcher.dispatch(
        {bucket: bucketId.toHexString(), type: "update"},
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
    const _ = createHistory(this.bs, this.history, bucketId, previousDocument, currentDocument);

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
    @Param("bucketId", OBJECT_ID) bucketId: ObjectId,
    @Param("documentId", OBJECT_ID) documentId: ObjectId,
    @Headers() headers: object,
    @StrategyType() strategyType: string,
    @Body() patch: Partial<BucketDocument>
  ) {
    if (this.reviewDispatcher && strategyType == "APIKEY") {
      const allowed = await this.reviewDispatcher.dispatch(
        {bucket: bucketId.toHexString(), type: "update"},
        headers,
        documentId.toHexString()
      );
      if (!allowed) {
        throw new ForbiddenException("Forbidden action.");
      }
    }

    const previousDocument = await this.bds.findOne(bucketId, {_id: documentId});

    const patchedDocument = getPatchedDocument(previousDocument, patch);

    await this.validator.validate({$ref: bucketId.toString()}, patchedDocument).catch(error => {
      throw new BadRequestException(
        (error.errors || []).map(e => `${e.dataPath} ${e.message}`).join("\n"),
        error.message
      );
    });

    const updateQuery = updateQueryForPatch(patch);

    const currentDocument = await this.bds.findOneAndUpdate(
      bucketId,
      {_id: documentId},
      updateQuery,
      {returnOriginal: false}
    );

    const _ = createHistory(this.bs, this.history, bucketId, previousDocument, currentDocument);

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
    if (this.reviewDispatcher && strategyType == "APIKEY") {
      const allowed = await this.reviewDispatcher.dispatch(
        {bucket: bucketId.toHexString(), type: "delete"},
        headers,
        documentId.toHexString()
      );
      if (!allowed) {
        throw new ForbiddenException("Forbidden action.");
      }
    }

    let deletedDocument: BucketDocument;

    if (this.changeEmitter) {
      deletedDocument = await this.bds.findOne(bucketId, {_id: documentId});
    }
    const {deletedCount} = await this.bds.deleteOne(bucketId, {_id: documentId});

    if (deletedCount > 0) {
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
}
