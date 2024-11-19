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
import {activity} from "@spica/api/src/activity/services";
import {HistoryService} from "@spica/api/src/bucket/history";
import {Bucket, BucketDataService, BucketService} from "@spica/api/src/bucket/services";
import {Schema, Validator} from "@spica/core";
import {ObjectId, OBJECT_ID} from "@spica/database";
import {ActionGuard, AuthGuard, ResourceFilter} from "@spica/api/src/passport/guard";
import {createBucketActivity} from "@spica/api/src/bucket/common";
import * as expression from "@spica/api/src/bucket/expression";
import {BucketCacheService, invalidateCache} from "@spica/api/src/bucket/cache";
import * as CRUD from "./crud";
import {applyPatch, getUpdateQueryForPatch} from "@spica/core";
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
    return CRUD.insert(this.bs, bucket).catch(error => {
      throw new HttpException(error.message, error.status || 500);
    });
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
    return CRUD.replace(this.bs, this.bds, this.history, {...bucket, _id: id}).catch(error => {
      throw new HttpException(error.message, error.status || 500);
    });
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
    if (!previousBucket) {
      throw new NotFoundException(`Bucket with id ${id} does not exist.`);
    }

    const patchedBucket = applyPatch(previousBucket, patch);
    delete patchedBucket._id;

    return this.bs.findOneAndReplace({_id: id}, patchedBucket, {returnOriginal: false});
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
    return CRUD.remove(this.bs, this.bds, this.history, id);
  }
}
