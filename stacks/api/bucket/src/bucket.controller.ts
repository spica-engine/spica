import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpException,
  HttpStatus,
  InternalServerErrorException,
  NotFoundException,
  Optional,
  Param,
  Patch,
  Post,
  Put,
  UseGuards,
  UseInterceptors
} from "@nestjs/common";
import {activity} from "@spica-server/activity/services";
import {HistoryService} from "@spica-server/bucket/history";
import {Bucket, BucketDataService, BucketService} from "@spica-server/bucket/services";
import {Schema, Validator} from "@spica-server/core/schema";
import {ObjectId, OBJECT_ID} from "@spica-server/database";
import {ActionGuard, AuthGuard, ResourceFilter} from "@spica-server/passport/guard";
import {
  createBucketActivity,
} from "@spica-server/bucket/common";
import * as expression from "@spica-server/bucket/expression";
import {BucketCacheService, invalidateCache} from "@spica-server/bucket/cache";
import {clearRelationsOnDrop, updateDocumentsOnChange} from "./changes";
import { applyPatch, getUpdateQueryForPatch } from "@spica-server/core/patch";
/**
 * All APIs related to bucket schemas.
 * @name bucket
 */
@Controller("bucket")
export class BucketController {
  constructor(
    private bs: BucketService,
    private bds: BucketDataService,
    private validator: Validator,
    @Optional() private history: HistoryService,
    @Optional() private bucketCacheService: BucketCacheService
  ) {}

  /**
   * Returns predefined defaults
   */
  @Get("predefineddefaults")
  @UseGuards(AuthGuard())
  getPredefinedDefaults() {
    return this.bs.getPredefinedDefaults();
  }

  /**
   * Returns all schemas.
   */
  @Get()
  @UseGuards(AuthGuard(), ActionGuard("bucket:index"))
  index(@ResourceFilter() resourceFilter: object) {
    return this.bs.aggregate([resourceFilter, {$sort: {order: 1}}]).toArray();
  }

  /**
   * Returns the schema
   * @param id Identifier of the schema.
   */
  @Get(":id")
  @UseGuards(AuthGuard(), ActionGuard("bucket:show"))
  async show(@Param("id", OBJECT_ID) id: ObjectId) {
    return this.bs.findOne({_id: id});
  }

  /**
   * Replaces the current schema.
   * @param id Identifier of the schema.
   * @body ```json
   * {
   *    "icon": "basket",
   *    "title": "Sports",
   *    "properties": {
   *      "name": {
   *          "title": "Name",
   *          "description": "Name of the sport",
   *          "type": "string",
   *          "default": "Basket",
   *          "options": {
   *              "position": "left",
   *              "translate": true
   *          }
   *      }
   *    }
   *
   * }
   * ```
   */
  @UseInterceptors(activity(createBucketActivity))
  @Post()
  @UseGuards(AuthGuard(), ActionGuard("bucket:create"))
  async add(@Body(Schema.validate("http://spica.internal/bucket/schema")) bucket: Bucket) {
    this.ruleValidation(bucket);

    const insertedBucket = await this.bs.insertOne(bucket).catch(error => {
      throw new HttpException(error.message, error.status || 500);
    });
    this.bs.emitSchemaChanges();

    return insertedBucket;
  }

  ruleValidation(schema: Bucket) {
    try {
      expression.extractPropertyMap(schema.acl.read);
      expression.aggregate(schema.acl.read, {
        auth: {
          identifier: "",
          policies: []
        },
        document: {}
      });
    } catch (error) {
      throw new BadRequestException("Error occurred while parsing read rule\n" + error.message);
    }

    try {
      expression.run(schema.acl.write, {
        auth: {
          identifier: "",
          policies: []
        },
        document: {}
      });
    } catch (error) {
      throw new BadRequestException("Error occurred while parsing write rule\n" + error.message);
    }
  }

  /**
   * Replaces the current schema.
   * @param id Identifier of the schema.
   * @body ```json
   * {
   *    "icon": "basket",
   *    "title": "Sports",
   *    "properties": {
   *      "name": {
   *          "title": "Name",
   *          "description": "Name of the sport",
   *          "type": "string",
   *          "default": "Basket",
   *          "options": {
   *              "position": "left",
   *              "translate": true
   *          }
   *      }
   *    }
   *
   * }
   * ```
   */
  @UseInterceptors(activity(createBucketActivity), invalidateCache())
  @Put(":id")
  @UseGuards(AuthGuard(), ActionGuard("bucket:update"))
  async replaceOne(
    @Param("id", OBJECT_ID) id: ObjectId,
    @Body(Schema.validate("http://spica.internal/bucket/schema")) bucket: Bucket
  ) {
    this.ruleValidation(bucket);

    const previousSchema = await this.bs.findOne({_id: id});
    let currentSchema;

    try {
      currentSchema = await this.bs.findOneAndReplace({_id: id}, bucket, {
        returnOriginal: false
      });
    } catch (error) {
      throw new InternalServerErrorException(error.message);
    }

    await updateDocumentsOnChange(this.bds, previousSchema, currentSchema);

    this.bs.emitSchemaChanges();

    if (this.history) {
      await this.history.updateHistories(previousSchema, currentSchema);
    }

    return currentSchema;
  }

  /**
   * Updates the schema partially. The provided body has to be a `json merge patch`.
   * See: https://tools.ietf.org/html/rfc7386
   * @param id Identifier of the schema.
   * @accepts application/merge-patch+json
   * @body ```json
   * {
   *    "name": "Update only the name but keep the rest as is."
   * }
   * ```
   */
  @Patch(":id")
  @UseGuards(AuthGuard(), ActionGuard("bucket:update"))
  async updateOne(
    @Param("id", OBJECT_ID) id: ObjectId,
    @Headers("content-type") contentType: string,
    @Body(
      Schema.validate({
        type: "object",
        properties: {
          category: {
            type: ["string", "null"]
          },
          order: {
            type: ["number", "null"]
          }
        },
        additionalProperties: false
      })
    )
    patch: object
  ) {
    if (contentType != "application/merge-patch+json") {
      throw new BadRequestException(`Content type '${contentType}' is not supported.`);
    }

    const previousBucket = await this.bs.findOne({_id: id});
    if(previousBucket){
      throw new NotFoundException(`Bucket with id ${id} does not exist.`)
    }

    const patchedBucket = applyPatch(previousBucket, patch);
    patchedBucket.properties = previousBucket.properties;

    const updateQuery = getUpdateQueryForPatch(patch, patchedBucket);

    return this.bs.findOneAndUpdate({_id: id}, updateQuery, {returnOriginal: false});
  }

  validateBucket(schemaId: string, bucket: any): Promise<void> {
    const validatorMixin = Schema.validate(schemaId);
    const pipe: any = new validatorMixin(this.validator);
    return pipe.transform(bucket);
  }

  @Delete("cache")
  @HttpCode(HttpStatus.NO_CONTENT)
  clearCache() {
    if (this.bucketCacheService) {
      return this.bucketCacheService.reset();
    }
  }

  /**
   * Removes the schema
   * @param id Identifier of the schema
   */
  @UseInterceptors(activity(createBucketActivity), invalidateCache())
  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AuthGuard(), ActionGuard("bucket:delete"))
  async deleteOne(@Param("id", OBJECT_ID) id: ObjectId) {
    const schema = await this.bs.drop(id);
    if (schema) {
      const promises = [];
      promises.push(clearRelationsOnDrop(this.bs, this.bds, id));
      if (this.history) {
        promises.push(this.history.deleteMany({bucket_id: id}));
      }
      await Promise.all(promises);
      this.bs.emitSchemaChanges();
    }
    return;
  }
}
