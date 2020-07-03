import {
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
  UseInterceptors,
  BadRequestException,
  UnauthorizedException
} from "@nestjs/common";
import {activity} from "@spica-server/activity/services";
import {ActionDispatcher} from "@spica-server/bucket/hooks";
import {BucketDocument, BucketService} from "@spica-server/bucket/services";
import {BOOLEAN, DEFAULT, JSONP, JSONPR, NUMBER} from "@spica-server/core";
import {Schema} from "@spica-server/core/schema";
import {FilterQuery, MongoError, ObjectId, OBJECT_ID} from "@spica-server/database";
import {ActionGuard, AuthGuard, policyAggregation} from "@spica-server/passport";
import * as locale from "locale";
import {createBucketDataActivity} from "./activity.resource";
import {BucketDataService, getBucketDataCollection} from "./bucket-data.service";
import {findRelations} from "./utilities";
import {HistoryService} from "./history/history.service";

function filterReviver(k: string, v: string) {
  const availableConstructors = {
    Date: v => new Date(v),
    ObjectId: v => new ObjectId(v)
  };
  const ctr = /^([a-zA-Z]+)\((.*?)\)$/;
  if (typeof v == "string" && ctr.test(v)) {
    const [, desiredCtr, arg] = v.match(ctr);
    if (availableConstructors[desiredCtr]) {
      return availableConstructors[desiredCtr](arg);
    } else {
      throw new Error(`Could not find the constructor ${desiredCtr} in {"${k}":"${v}"}`);
    }
  }
  return v;
}

@Controller("bucket/:bucketId/data")
export class BucketDataController {
  constructor(
    private bs: BucketService,
    private bds: BucketDataService,
    @Optional() private dispatcher: ActionDispatcher,
    @Optional() private history: HistoryService
  ) {}

  private async getLanguage(language: string) {
    const bucketSettings = await this.bs.getPreferences();

    const supportedLocales = new locale.Locales(Object.keys(bucketSettings.language.available));
    const locales = new locale.Locales(language);
    const bestLocale = locales.best(supportedLocales);

    const best =
      bestLocale && !bestLocale.defaulted ? bestLocale.normalized : bucketSettings.language.default;

    const fallback = bucketSettings.language.default;

    return {best, fallback};
  }

  private buildI18nAggregation(property: any, locale: string, fallback: string) {
    return {
      $mergeObjects: [
        property,
        {
          $arrayToObject: {
            $map: {
              input: {
                $filter: {
                  input: {
                    $objectToArray: property
                  },
                  as: "item",
                  cond: {
                    $eq: [
                      {
                        $type: "$$item.v"
                      },
                      "object"
                    ]
                  }
                }
              },
              as: "prop",
              in: {
                k: "$$prop.k",
                v: {
                  $ifNull: [
                    `$$prop.v.${locale}`,
                    {
                      $ifNull: [`$$prop.v.${fallback}`, `$$prop.v`]
                    }
                  ]
                }
              }
            }
          }
        }
      ]
    };
  }

  private buildRelationAggregation(
    property: string,
    bucketId: string,
    type: "onetomany" | "onetoone",
    locale: {best: string; fallback: string}
  ) {
    if (type == "onetomany") {
      return [
        {
          $lookup: {
            from: getBucketDataCollection(bucketId),
            let: {
              documentIds: {
                $ifNull: [
                  {
                    $map: {
                      input: `$${property}`,
                      in: {$toObjectId: "$$this"}
                    }
                  },
                  []
                ]
              }
            },
            pipeline: [
              {$match: {$expr: {$in: ["$_id", "$$documentIds"]}}},
              {$replaceWith: this.buildI18nAggregation("$$ROOT", locale.best, locale.fallback)},
              {$set: {_id: {$toString: "$_id"}}}
            ],
            as: property
          }
        }
      ];
    } else {
      return [
        {
          $lookup: {
            from: getBucketDataCollection(bucketId),
            let: {
              documentId: {
                $toObjectId: `$${property}`
              }
            },
            pipeline: [
              {$match: {$expr: {$eq: ["$_id", "$$documentId"]}}},
              {$replaceWith: this.buildI18nAggregation("$$ROOT", locale.best, locale.fallback)},
              {$set: {_id: {$toString: "$_id"}}}
            ],
            as: property
          }
        },
        {$unwind: {path: `$${property}`, preserveNullAndEmptyArrays: true}}
      ];
    }
  }

  isAllowedBucket(resourceState: {alloweds: string[]; denieds: string[]}, id: string) {
    return (
      (resourceState.alloweds.includes("*") && !resourceState.denieds.includes(id)) ||
      resourceState.alloweds.includes(id)
    );
  }

  @Get()
  @UseGuards(AuthGuard(), ActionGuard("bucket:data:index"))
  async find(
    @Headers("resource-state") resourceState,
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
    if (!this.isAllowedBucket(resourceState, bucketId.toHexString())) {
      throw new ForbiddenException("You do not have sufficient permissions to do this action.");
    }

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

    const schema = relation || localize ? bucket : null;

    if (
      localize &&
      Object.values(schema.properties).some(
        property => property.options && property.options.translate
      )
    ) {
      const locale = await this.getLanguage(acceptedLanguage);

      aggregation.push({
        $replaceWith: this.buildI18nAggregation("$$ROOT", locale.best, locale.fallback)
      });
    }

    if (sort) {
      aggregation.push({
        $sort: sort
      });
    }

    if (relation) {
      for (const propertyKey in schema.properties) {
        const property = schema.properties[propertyKey];
        if (property.type == "relation") {
          aggregation.push(
            ...this.buildRelationAggregation(
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

    if (localize) {
      const locale = await this.getLanguage(acceptedLanguage);

      aggregation.unshift({
        $replaceWith: this.buildI18nAggregation("$$ROOT", locale.best, locale.fallback)
      });
    }

    if (relation) {
      const schema = await this.bs.findOne({_id: bucketId});
      for (const propertyKey in schema.properties) {
        const property = schema.properties[propertyKey];
        if (property.type == "relation") {
          aggregation.push(
            ...this.buildRelationAggregation(
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
  async replaceOne(
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
    return this.bds.insertOne(bucketId, body).then(result => result.ops[0]);
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

    return this.bds
      .replaceOne(bucketId, {_id: documentId}, body, {returnOriginal: true})
      .then(result => {
        if (result.ok == 1 && result.value) {
          const currentDocument = {...body, _id: documentId};
          const _ = this.createHistory(bucketId, result.value, currentDocument);
          return currentDocument;
        } else {
          throw new BadRequestException();
        }
      });
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
    let deletedCount = await this.bds
      .deleteOne(bucketId, {_id: documentId})
      .then(result => result.deletedCount);
    if (deletedCount < 1) return;

    if (this.history) {
      await this.history.deleteMany({
        document_id: documentId
      });
    }

    return this.clearRelations(this.bs, bucketId, documentId);
  }

  @UseInterceptors(activity(createBucketDataActivity))
  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AuthGuard(), ActionGuard("bucket:data:delete"))
  async deleteMany(
    @Headers("strategy-type") strategyType: string,
    @Param("bucketId", OBJECT_ID) bucketId: ObjectId,
    @Body() body
  ) {
    if (strategyType == "APIKEY") {
      throw new BadRequestException(
        "Apikey strategy doesn't support to delete multiple resource at once."
      );
    }
    let deletedCount = await this.bds
      .deleteMany(bucketId, body)
      .then(result => result.deletedCount);
    if (deletedCount < 1) return;

    if (this.history) {
      await Promise.all(
        body.map(id => {
          this.history.deleteMany({
            document_id: new ObjectId(id)
          });
        })
      );
    }

    return Promise.all(
      body.map(id => {
        this.clearRelations(this.bs, bucketId, new ObjectId(id)).catch(err => err);
      })
    );
  }

  async clearRelations(bucketService: BucketService, bucketId: ObjectId, documentId: ObjectId) {
    let buckets = await bucketService.find({_id: {$ne: bucketId}});
    if (buckets.length < 1) return;

    for (const bucket of buckets) {
      let targets = findRelations(bucket.properties, bucketId.toHexString(), "", []);
      if (targets.length < 1) continue;

      for (const target of targets) {
        await bucketService
          .collection(`bucket_${bucket._id.toHexString()}`)
          .updateMany({[target]: documentId.toHexString()}, {$unset: {[target]: ""}});
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
