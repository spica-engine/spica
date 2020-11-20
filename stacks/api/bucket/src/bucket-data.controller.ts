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
import {aggregate, extractPropertyMap, run} from "@spica-server/bucket/expression";
import {HistoryService} from "@spica-server/bucket/history";
import {ChangeEmitter} from "@spica-server/bucket/hooks";
import {BucketDocument, BucketService} from "@spica-server/bucket/services";
import {ARRAY, BOOLEAN, BooleanCheck, DEFAULT, JSONP, JSONPR, NUMBER, OR} from "@spica-server/core";
import {Schema, Validator} from "@spica-server/core/schema";
import {ObjectId, OBJECT_ID} from "@spica-server/database";
import {ActionGuard, AuthGuard, ResourceFilter, StrategyType} from "@spica-server/passport/guard";
import {createBucketDataActivity} from "./activity.resource";
import {BucketDataService} from "./bucket-data.service";
import {buildI18nAggregation, findLocale, hasTranslatedProperties} from "./locale";
import {applyPatch, getUpdateQueryForPatch} from "./patch";
import {
  clearRelations,
  createHistory,
  createRelationMap,
  filterReviver,
  getRelationPipeline,
  resetNonOverlappingPathsInRelationMap
} from "./relation";

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
    const pipeline: object[] = [
      resourceFilter,
      {
        $match: {
          _schedule: {
            $exists: schedule
          }
        }
      }
    ];

    const schema = await this.bs.findOne({_id: bucketId});

    if (!schema) {
      throw new NotFoundException(`Could not find the schema with id ${bucketId}`);
    }

    if (sort) {
      pipeline.push({
        $sort: sort
      });
    }

    const locale = findLocale(acceptedLanguage, await this.bs.getPreferences());

    if (localize && hasTranslatedProperties(schema.properties)) {
      pipeline.push({
        $replaceWith: buildI18nAggregation("$$ROOT", locale.best, locale.fallback)
      });
      req.res.header("Content-language", locale.best || locale.fallback);
    }

    // Relation
    let relationPaths: string[][] = [];

    if (relation == true) {
      for (const propertyKey in schema.properties) {
        if (schema.properties[propertyKey].type != "relation") {
          continue;
        }
        relationPaths.push([propertyKey]);
      }
    } else if (Array.isArray(relation)) {
      relationPaths = relation.map(pattern => pattern.split("."));
    }

    const propertyMap = extractPropertyMap(schema.acl.read).map(path => path.split("."));

    const relationMap = await createRelationMap({
      paths: [...relationPaths, ...propertyMap],
      properties: schema.properties,
      resolve: (bucketId: string) => this.bs.findOne({_id: new ObjectId(bucketId)})
    });

    // ACL
    const relationStage = getRelationPipeline(relationMap, locale);

    pipeline.push(...relationStage);

    const match = aggregate(schema.acl.read, {auth: req.user});

    pipeline.push({
      $match: match
    });

    const resetStage = resetNonOverlappingPathsInRelationMap({
      left: relationPaths,
      right: propertyMap,
      map: relationMap
    });

    if (resetStage) {
      // Reset those relations which have been requested by acl rules.
      pipeline.push(resetStage);
    }

    if (typeof filter == "object") {
      pipeline.push({
        $set: {
          _id: {
            $toString: `$_id`
          }
        }
      });

      pipeline.push({$match: filter});
    }

    const data = this.bds.children(bucketId);

    const seekingPipeline = [];

    if (skip) {
      seekingPipeline.push({$skip: skip});
    }

    if (limit) {
      seekingPipeline.push({$limit: limit});
    }

    if (paginate) {
      pipeline.push(
        {
          $facet: {
            meta: [{$count: "total"}],
            data: seekingPipeline.length ? seekingPipeline : [{$unwind: "$_id"}]
          }
        },
        {$unwind: {path: "$meta", preserveNullAndEmptyArrays: true}}
      );

      const result = await data.aggregate(pipeline).next();

      return result ? result : {meta: {total: 0}, data: []};
    } else {
      return data.aggregate([...pipeline, ...seekingPipeline]).toArray();
    }
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
    const pipeline: object[] = [{$match: {_id: documentId}}, {$limit: 1}];

    const locale = findLocale(acceptedLanguage, await this.bs.getPreferences());

    if (localize) {
      pipeline.unshift({
        $replaceWith: buildI18nAggregation("$$ROOT", locale.best, locale.fallback)
      });
      req.res.header("Content-language", locale.best || locale.fallback);
    }

    const schema = await this.bs.findOne({_id: bucketId});

    // Relation
    let relationPaths: string[][] = [];

    if (relation == true) {
      for (const propertyKey in schema.properties) {
        if (schema.properties[propertyKey].type != "relation") {
          continue;
        }
        relationPaths.push([propertyKey]);
      }
    } else if (Array.isArray(relation)) {
      relationPaths = relation.map(pattern => pattern.split("."));
    }

    const propertyMap = extractPropertyMap(schema.acl.read).map(path => path.split("."));

    const relationMap = await createRelationMap({
      paths: [...relationPaths, ...propertyMap],
      properties: schema.properties,
      resolve: (bucketId: string) => this.bs.findOne({_id: new ObjectId(bucketId)})
    });

    // ACL
    const relationStage = getRelationPipeline(relationMap, locale);

    pipeline.push(...relationStage);

    const match = aggregate(schema.acl.read, {auth: req.user});

    pipeline.push({
      $match: match
    });

    const resetStage = resetNonOverlappingPathsInRelationMap({
      left: relationPaths,
      right: propertyMap,
      map: relationMap
    });

    if (resetStage) {
      // Reset those relations which have been requested by acl rules.
      pipeline.push(resetStage);
    }

    return this.bds
      .children(bucketId)
      .aggregate(pipeline)
      .next();
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
  //@UseInterceptors(activity(createBucketDataActivity))
  @Post()
  @UseGuards(AuthGuard(), ActionGuard("bucket:data:create"))
  async insertOne(
    @Req() req,
    @Param("bucketId", OBJECT_ID) bucketId: ObjectId,
    @Body(Schema.validate(req => req.params.bucketId)) rawDocument: BucketDocument
  ) {
    const schema = await this.bs.findOne({_id: bucketId});

    const bkt = this.bds.children(bucketId);

    const paths = extractPropertyMap(schema.acl.write).map(path => path.split("."));

    const relationMap = await createRelationMap({
      properties: schema.properties,
      paths,
      resolve: (bucketId: string) => this.bs.findOne({_id: new ObjectId(bucketId)})
    });

    const relationStage = getRelationPipeline(relationMap, undefined);

    const fullDocument = await this.bds
      .children("buckets")
      .aggregate([
        {$limit: 1},
        {
          $replaceWith: rawDocument
        },
        ...relationStage
      ])
      .next();

    const aclResult = run(schema.acl.write, {auth: req.user, document: fullDocument});

    if (!aclResult) {
      throw new ForbiddenException("ACL rules has rejected this operation.");
    }

    const document = await bkt.insertOne(rawDocument);

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

    const bkt = this.bds.children(bucketId);

    const paths = extractPropertyMap(schema.acl.write).map(path => path.split("."));

    const relationMap = await createRelationMap({
      properties: schema.properties,
      paths,
      resolve: (bucketId: string) => this.bs.findOne({_id: new ObjectId(bucketId)})
    });

    const relationStage = getRelationPipeline(relationMap, undefined);

    const fullDocument = await this.bds
      .children("buckets")
      .aggregate([
        {$limit: 1},
        {
          $replaceWith: document
        },
        ...relationStage
      ])
      .next();

    const aclResult = run(schema.acl.write, {auth: req.user, document: fullDocument});

    if (!aclResult) {
      throw new ForbiddenException("ACL rules has rejected this operation.");
    }

    const previousDocument = await bkt.findOneAndReplace({_id: documentId}, document, {
      returnOriginal: true
    });

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
        (error.errors || []).map(e => `${e.dataPath} ${e.message}`).join("\n"),
        error.message
      );
    });

    const paths = extractPropertyMap(schema.acl.write).map(path => path.split("."));

    const relationMap = await createRelationMap({
      properties: schema.properties,
      paths,
      resolve: (bucketId: string) => this.bs.findOne({_id: new ObjectId(bucketId)})
    });

    const relationStage = getRelationPipeline(relationMap, undefined);

    const fullDocument = await this.bds
      .children("buckets")
      .aggregate([
        {$limit: 1},
        {
          $replaceWith: patchedDocument
        },
        ...relationStage
      ])
      .next();

    const aclResult = run(schema.acl.write, {auth: req.user, document: fullDocument});

    if (!aclResult) {
      throw new ForbiddenException("ACL rules has rejected this operation.");
    }

    const updateQuery = getUpdateQueryForPatch(patch);

    const currentDocument = await bkt.findOneAndUpdate({_id: documentId}, updateQuery, {
      returnOriginal: false
    });

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
    const bkt = this.bds.children(bucketId);

    const deletedDocument = await bkt.findOne({_id: documentId});

    const schema = await this.bs.findOne({_id: bucketId});

    const paths = extractPropertyMap(schema.acl.write).map(path => path.split("."));

    const relationMap = await createRelationMap({
      properties: schema.properties,
      paths,
      resolve: (bucketId: string) => this.bs.findOne({_id: new ObjectId(bucketId)})
    });

    const relationStage = getRelationPipeline(relationMap, undefined);

    const fullDocument = await this.bds
      .children("buckets")
      .aggregate([
        {$limit: 1},
        {
          $replaceWith: deletedDocument
        },
        ...relationStage
      ])
      .next();

    const aclResult = run(schema.acl.write, {auth: req.user, document: fullDocument});

    if (!aclResult) {
      throw new ForbiddenException("ACL rules has rejected this operation.");
    }

    const deletedCount = await bkt.deleteOne({_id: documentId});

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
