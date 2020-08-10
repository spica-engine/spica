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
import {FilterQuery, MongoError, ObjectId, OBJECT_ID} from "@spica-server/database";
import {ActionGuard, AuthGuard} from "@spica-server/passport";

import {createBucketDataActivity} from "./activity.resource";
import {BucketDataService} from "./bucket-data.service";
import {findRelations, filterReviver, buildRelationAggregation, getUpdateParams} from "./utility";
import {findLocale, buildI18nAggregation, hasTranslatedProperties, Locale} from "./locale";

@Controller("bucket/:bucketId/data")
export class BucketDataController {
  constructor(
    private bs: BucketService,
    private bds: BucketDataService,
    @Optional() private dispatcher: ActionDispatcher,
    @Optional() private history: HistoryService,
    @Optional() private changes: DataChangeEmitter
  ) {}

  @Get()
  @UseGuards(AuthGuard(), ActionGuard("bucket:data:index"))
  async find(
    @Headers("strategy-type") strategyType: string,
    @Param("bucketId", OBJECT_ID) bucketId: ObjectId,
    @Headers("accept-language") acceptedLanguage: string,
    @Headers() headers: object,
    @Query("relation", DEFAULT(false), BOOLEAN) relation: boolean = false,
    @Query("paginate", DEFAULT(false), BOOLEAN) paginate: boolean = false,
    @Query("schedule", DEFAULT(false), BOOLEAN) schedule: boolean = false,
    @Query("localize", DEFAULT(true), BOOLEAN) localize: boolean = true,
    @Query("filter", JSONPR(filterReviver)) filter: FilterQuery<BucketDocument>,
    @Query("limit", NUMBER) limit: number,
    @Query("skip", NUMBER) skip: number,
    @Query("sort", JSONP) sort: object
  ) {
    let aggregation: unknown[] = [
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

  @Get(":documentId")
  @UseGuards(AuthGuard(), ActionGuard("bucket:data:show"))
  async findOne(
    @Headers("strategy-type") strategyType: string,
    @Headers("accept-language") acceptedLanguage: string,
    @Headers() headers: object,
    @Param("bucketId", OBJECT_ID) bucketId: ObjectId,
    @Param("documentId", OBJECT_ID) documentId: ObjectId,
    @Query("localize", DEFAULT(true), BOOLEAN) localize: boolean = true,
    @Query("relation", DEFAULT(false), BOOLEAN) relation: boolean = false
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

  @UseInterceptors(activity(createBucketDataActivity))
  @Post()
  @UseGuards(AuthGuard(), ActionGuard("bucket:data:create"))
  async insertOne(
    @Headers("strategy-type") strategyType: string,
    @Param("bucketId", OBJECT_ID) bucketId: ObjectId,
    @Headers() headers: object,
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

  @UseInterceptors(activity(createBucketDataActivity))
  @Put(":documentId")
  @UseGuards(AuthGuard(), ActionGuard("bucket:data:update"))
  async update(
    @Headers("strategy-type") strategyType: string,
    @Param("bucketId", OBJECT_ID) bucketId: ObjectId,
    @Param("documentId", OBJECT_ID) documentId: ObjectId,
    @Headers() headers: object,
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

  @UseInterceptors(activity(createBucketDataActivity))
  @Delete(":documentId")
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AuthGuard(), ActionGuard("bucket:data:delete"))
  async deleteOne(
    @Headers("strategy-type") strategyType: string,
    @Headers() headers: object,
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

  @UseInterceptors(activity(createBucketDataActivity))
  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AuthGuard(), ActionGuard("bucket:data:delete"))
  async deleteMany(
    @Headers("strategy-type") strategyType: string,
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
