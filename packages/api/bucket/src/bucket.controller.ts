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
  Inject,
  NotFoundException,
  Optional,
  Param,
  Patch,
  Post,
  Put,
  UseGuards,
  UseInterceptors
} from "@nestjs/common";
import {activity} from "@spica-server/activity-services";
import {HISTORY_REPOSITORY, HistoryRepository} from "@spica-server/interface-bucket-history";
import {BucketService} from "@spica-server/bucket-services";
import {Schema, Validator} from "@spica-server/core-schema";
import {ID} from "@spica-server/data";
import {COLLECTION_QUERY, CollectionQueryFacade, Id} from "@spica-server/interface-data";
import {ActionGuard, AuthGuard, ResourceFilter} from "@spica-server/passport-guard";
import {createBucketActivity} from "@spica-server/bucket-common";
import {BucketCacheService, invalidateCache} from "@spica-server/bucket-cache";
import * as CRUD from "./crud.js";
import {applyPatch, getUpdateQueryForPatch} from "@spica-server/core-patch";
import {Bucket, BUCKET_DATA_REPOSITORY, BucketDataRepository} from "@spica-server/interface-bucket";

/**
 * All APIs related to bucket schemas.
 * @name bucket
 */
@Controller("bucket")
export class BucketController {
  constructor(
    private bs: BucketService,
    @Inject(BUCKET_DATA_REPOSITORY) private bucketData: BucketDataRepository,
    private validator: Validator,
    @Inject(COLLECTION_QUERY) private queries: CollectionQueryFacade,
    @Optional() @Inject(HISTORY_REPOSITORY) private history: HistoryRepository,
    @Optional() private bucketCacheService: BucketCacheService
  ) {}

  /**
   * Returns predefined defaults
   */
  @Get("predefineddefaults")
  @UseGuards(AuthGuard(["IDENTITY", "APIKEY"]))
  getPredefinedDefaults() {
    return this.bs.getPredefinedDefaults();
  }

  /**
   * Returns all schemas.
   */
  @Get()
  @UseGuards(AuthGuard(["IDENTITY", "APIKEY"]), ActionGuard("bucket:index"))
  index(@ResourceFilter({collection: "buckets"}) resourceFilter: object) {
    return CRUD.find(this.queries, {resourceFilter, sort: {order: 1}});
  }

  /**
   * Returns the schema
   * @param id Identifier of the schema.
   */
  @Get(":id")
  @UseGuards(AuthGuard(["IDENTITY", "APIKEY"]), ActionGuard("bucket:show"))
  async show(@Param("id", ID("buckets")) id: Id) {
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
  @UseGuards(AuthGuard(["IDENTITY", "APIKEY"]), ActionGuard("bucket:create"))
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
  @UseGuards(AuthGuard(["IDENTITY", "APIKEY"]), ActionGuard("bucket:update"))
  async replaceOne(
    @Param("id", ID("buckets")) id: Id,
    @Body(Schema.validate("http://spica.internal/bucket/schema")) bucket: Bucket
  ) {
    return CRUD.replace(this.bs, this.bucketData, this.history, {...bucket, _id: id}).catch(
      error => {
        throw new HttpException(error.message, error.status || 500);
      }
    );
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
  @UseGuards(AuthGuard(["IDENTITY", "APIKEY"]), ActionGuard("bucket:update"))
  async updateOne(
    @Param("id", ID("buckets")) id: Id,
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

    const previousBucket = await this.bs.findById(id);
    if (!previousBucket) {
      throw new NotFoundException(`Bucket with id ${id} does not exist.`);
    }

    const patchedBucket = applyPatch(previousBucket, patch);
    delete patchedBucket._id;

    return this.bs.replaceById(id, patchedBucket);
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
  @UseGuards(AuthGuard(["IDENTITY", "APIKEY"]), ActionGuard("bucket:delete"))
  async deleteOne(@Param("id", ID("buckets")) id: Id) {
    return CRUD.remove(this.bs, this.bucketData, this.history, id);
  }
}
