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
import {activity} from "@spica-server/activity/services";
import {HistoryService} from "@spica-server/bucket/history";
import {Bucket, BucketDataService, BucketService} from "@spica-server/bucket/services";
import {Schema} from "@spica-server/core/schema";
import {ObjectId, OBJECT_ID} from "@spica-server/database";
import {ActionGuard, AuthGuard, ResourceFilter} from "@spica-server/passport/guard";
import {createBucketActivity} from "./activity.resource";
import {findRelations} from "./relation";
import {schemaDiff, ChangeKind} from "@spica-server/core/differ";
import * as expression from "@spica-server/bucket/expression";
/**
 * All APIs related to bucket schemas.
 * @name bucket
 */
@Controller("bucket")
export class BucketController {
  constructor(
    private bs: BucketService,
    private bds: BucketDataService,
    @Optional() private history: HistoryService
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

    const insertedBucket = await this.bs.insertOne(bucket);
    this.bs.emitSchemaChanges();

    return insertedBucket;
  }

  ruleValidation(schema: Bucket) {
    try {
      expression.extractPropertyMap(schema.acl.read);
      expression.aggregate(schema.acl.read, {
        auth: {},
        document: {}
      });
    } catch (error) {
      throw new BadRequestException("Error occured while parsing read rule\n" + error.message);
    }

    try {
      expression.run(schema.acl.write, {
        auth: {},
        document: {}
      });
    } catch (error) {
      throw new BadRequestException("Error occured while parsing write rule\n" + error.message);
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
  @UseInterceptors(activity(createBucketActivity))
  @Put(":id")
  @UseGuards(AuthGuard(), ActionGuard("bucket:update"))
  async replaceOne(
    @Param("id", OBJECT_ID) id: ObjectId,
    @Body(Schema.validate("http://spica.internal/bucket/schema")) bucket: Bucket
  ) {
    this.ruleValidation(bucket);

    const previousSchema = await this.bs.findOne({_id: id});
    const currentSchema = await this.bs.findOneAndReplace({_id: id}, bucket, {
      returnOriginal: false
    });

    await this.clearUpdatedFields(this.bds, previousSchema, currentSchema);

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
    @Body() changes: object
  ) {
    if (contentType != "application/merge-patch+json") {
      throw new BadRequestException(`Content type '${contentType}' is not supported.`);
    }
    return this.bs.findOneAndUpdate({_id: id}, {$set: changes}, {returnOriginal: false});
  }

  /**
   * Removes the schema
   * @param id Identifier of the schema
   */
  @UseInterceptors(activity(createBucketActivity))
  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AuthGuard(), ActionGuard("bucket:delete"))
  async deleteOne(@Param("id", OBJECT_ID) id: ObjectId) {
    const deletedCount = await this.bs.deleteOne({_id: id});
    if (deletedCount > 0) {
      const promises = [];
      promises.push(
        this.bds.children(id).deleteMany({}),
        this.clearRelations(this.bs, this.bds, id)
      );
      if (this.history) {
        promises.push(this.history.deleteMany({bucket_id: id}));
      }
      await Promise.all(promises);
      this.bs.emitSchemaChanges();
    }
    return;
  }

  async clearRelations(
    bucketService: BucketService,
    bucketDataService: BucketDataService,
    bucketId: ObjectId
  ) {
    const buckets = await bucketService.find();

    const updatePromises = [];

    for (const bucket of buckets) {
      const targets = Array.from(
        findRelations(bucket.properties, bucketId.toHexString(), "", new Map()).keys()
      );

      const unsetFieldsBucket = targets.reduce((acc, current) => {
        current = "properties." + current.replace(/\./g, ".properties.");
        acc = {...acc, [current]: ""};
        return acc;
      }, {});

      if (Object.keys(unsetFieldsBucket).length) {
        updatePromises.push(
          bucketService.updateMany({_id: bucket._id}, {$unset: unsetFieldsBucket})
        );
      }

      const unsetFieldsBucketData = targets.reduce((acc, current) => {
        acc = {...acc, [current]: ""};
        return acc;
      }, {});

      if (Object.keys(unsetFieldsBucketData).length) {
        updatePromises.push(
          bucketDataService.children(bucket._id).updateMany({}, {$unset: unsetFieldsBucketData})
        );
      }
    }

    return Promise.all(updatePromises);
  }
  async clearUpdatedFields(
    bucketDataService: BucketDataService,
    previousSchema: Bucket,
    currentSchema: Bucket
  ) {
    const targets = schemaDiff(previousSchema, currentSchema)
      .filter(change => {
        if (change.kind == ChangeKind.Add) {
          return false;
        }

        if (change.lastPath.length) {
          for (const keyword of ["type", "relationType", "bucketId"]) {
            if (change.lastPath.includes(keyword)) {
              return true;
            }
          }
          return false;
        }

        return true;
      })
      // for array targets
      .map(change => change.path.join(".").replace(/\/\[0-9]\*\//g, "$[]"));

    const unsetFields = {};

    for (const target of targets) {
      unsetFields[target] = "";
    }

    if (!Object.keys(unsetFields).length) {
      return;
    }

    await bucketDataService.children(previousSchema._id).updateMany({}, {$unset: unsetFields});
  }
}
