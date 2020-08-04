import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Optional,
  Param,
  Patch,
  Post,
  Put,
  UseGuards,
  UseInterceptors
} from "@nestjs/common";
import { activity } from "@spica-server/activity/services";
import { HistoryService } from "@spica-server/bucket/history";
import { Bucket, BucketService } from "@spica-server/bucket/services";
import { Schema } from "@spica-server/core/schema";
import { ObjectId, OBJECT_ID } from "@spica-server/database";
import { ActionGuard, AuthGuard } from "@spica-server/passport";
import { createBucketActivity } from "./activity.resource";
import { BucketDataService } from "./bucket-data.service";
import { findRelations, findRemovedKeys } from "./utilities";

@Controller("bucket")
export class BucketController {
  constructor(
    private bs: BucketService,
    private bds: BucketDataService,
    @Optional() private history: HistoryService
  ) {}

  @Get()
  @UseGuards(AuthGuard(), ActionGuard("bucket:index"))
  index() {
    return this.bs.find({}, {sort: {order: 1}});
  }

  @Get("predefs")
  @UseGuards(AuthGuard(), ActionGuard("bucket:index"))
  getPredefinedDefaults() {
    return this.bs.getPredefinedDefaults();
  }

  @UseInterceptors(activity(createBucketActivity))
  @Post()
  @UseGuards(AuthGuard(), ActionGuard("bucket:create"))
  async add(@Body(Schema.validate("http://spica.internal/bucket/schema")) bucket: Bucket) {
    const insertedDocument = await this.bs.insertOne(bucket);
    await this.bs.createCollection(`bucket_${insertedDocument._id}`);
    return insertedDocument;
  }

  @UseInterceptors(activity(createBucketActivity))
  @Put(":id")
  @UseGuards(AuthGuard(), ActionGuard("bucket:update"))
  async replaceOne(
    @Param("id", OBJECT_ID) id: ObjectId,
    @Body(Schema.validate("http://spica.internal/bucket/schema")) bucket: Bucket
  ) {
    const previousSchema = await this.bs.findOne({_id: id});

    const currentSchema = await this.bs.findOneAndReplace({_id: id}, bucket, {returnOriginal: false});

    await this.clearRemovedFields(this.bds, previousSchema, currentSchema);

    if (this.history) {
      await this.history.updateHistories(previousSchema, currentSchema);
    }

    return currentSchema;
  }

  @Patch(":id")
  @UseGuards(AuthGuard(), ActionGuard("bucket:update"))
  async updateOne(
    @Param("id", OBJECT_ID) id: ObjectId,
    @Headers("content-type") contentType: string,
    @Body() changes: object
  ) {
    if (contentType != "application/merge-patch+json") {
      throw new BadRequestException(`Content type '${contentType}' is not supported.`);
    }
    return this.bs.findOneAndUpdate({_id: id}, {$set: changes}, {returnOriginal: false});
  }

  @Get(":id")
  @UseGuards(AuthGuard(), ActionGuard("bucket:show"))
  async show(@Param("id", OBJECT_ID) id: ObjectId) {
    return this.bs.findOne({_id: id});
  }

  @UseInterceptors(activity(createBucketActivity))
  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AuthGuard(), ActionGuard("bucket:delete"))
  async deleteOne(@Param("id", OBJECT_ID) id: ObjectId) {
    const deletedCount = await this.bs.deleteOne({_id: id});
    if ( deletedCount >  0 ) {
      await this.bds.deleteAll(id);
      await this.clearRelations(this.bs, this.bds, id);
      if (this.history) {
        await this.history.deleteMany({bucket_id: id});
      }
    }
    return;
  }

  async clearRelations(
    bucketService: BucketService,
    bucketDataService: BucketDataService,
    bucketId: ObjectId
  ) {
    let buckets = await bucketService.find({_id: {$ne: bucketId}});
    if (buckets.length < 1) return;

    for (const bucket of buckets) {
      let targets = findRelations(bucket.properties, bucketId.toHexString(), "", []);
      if (targets.length < 1) continue;

      let unsetFieldsBucket = targets.reduce((acc, current) => {
        current = "properties." + current.replace(/\./g, ".properties.");
        acc = {...acc, [current]: ""};
        return acc;
      }, {});

      await bucketService.updateMany({_id: bucket._id}, {$unset: unsetFieldsBucket});

      let unsetFieldsBucketData = targets.reduce((acc, current) => {
        acc = {...acc, [current]: ""};
        return acc;
      }, {});

      await bucketDataService.updateMany(bucket._id, {}, {$unset: unsetFieldsBucketData});
    }
  }
  async clearRemovedFields(
    bucketDataService: BucketDataService,
    previousSchema: Bucket,
    currentSchema: Bucket
  ) {
    let removedKeys = findRemovedKeys(previousSchema.properties, currentSchema.properties, [], "");
    if (removedKeys.length < 1) return;

    let unsetFields = removedKeys.reduce((pre, acc: any, index, array) => {
      acc = {...pre, [array[index]]: ""};
      return acc;
    }, {});

    await bucketDataService.updateMany(previousSchema._id, {}, {$unset: unsetFields});
  }
}
