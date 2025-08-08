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
  NotFoundException,
  Optional,
  Param,
  Patch,
  Post,
  Put,
  UseGuards,
  UseInterceptors
} from "@nestjs/common";
import {activity} from "../../activity/services";
import {HistoryService} from "../history";
import {BucketDataService, BucketService} from "../services";
import {Schema, Validator} from "../../../../../libs/core/schema";
import {ObjectId, OBJECT_ID, ReturnDocument} from "../../../../../libs/database";
import {ActionGuard, AuthGuard, ResourceFilter} from "../../passport/guard";
import {createBucketActivity} from "../common";
import {BucketCacheService, invalidateCache} from "../cache";
import * as CRUD from "./crud";
import {applyPatch, getUpdateQueryForPatch} from "../../../../../libs/core/patch";
import {Bucket} from "../../../../../libs/interface/bucket";

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
    return CRUD.find(this.bs, {resourceFilter, sort: {order: 1}});
  }

  /**
   * Returns the schema
   * @param id Identifier of the schema.
   */
  @Get(":id")
  @UseGuards(AuthGuard(), ActionGuard("bucket:show"))
  async show(@Param("id", OBJECT_ID) id: ObjectId) {
    return CRUD.findOne(this.bs, id);
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

    return this.bs.findOneAndReplace({_id: id}, patchedBucket, {
      returnDocument: ReturnDocument.AFTER
    });
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
