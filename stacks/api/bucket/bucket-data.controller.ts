import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpException,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Query,
  UseGuards
} from "@nestjs/common";
import {BOOLEAN, JSONP, NUMBER, JSONPV} from "@spica-server/core";
import {Schema} from "@spica-server/core/schema";
import {FilterQuery, ObjectId, OBJECT_ID} from "@spica-server/database";
import {ActionGuard, AuthGuard} from "@spica-server/passport";
import * as locale from "locale";
import {BucketEntry} from "./bucket";
import {BucketDataService, getBucketDataCollection} from "./bucket-data.service";
import {BucketService} from "./bucket.service";

@Controller("bucket/:bid/data")
export class BucketDataController {
  constructor(private bs: BucketService, private bds: BucketDataService) {}

  @Get()
  async find(
    @Headers("accept-language") acceptedLanguage: string,
    @Param("bid", OBJECT_ID) bid: ObjectId,
    @Query("prune", BOOLEAN) prune: boolean = false,
    @Query("filter", JSONPV((key, value) => (key === "$lookup" ? undefined : value)))
    filter: FilterQuery<BucketEntry>,
    @Query("limit", NUMBER) limit: number,
    @Query("skip", NUMBER) skip: number,
    @Query("sort", JSONP) sort: object
  ) {
    limit = limit || 10;
    const schema = await this.bs.findOne({_id: bid});

    const bucketSettings = await this.bs.getPreferences();

    if (!schema) {
      throw new HttpException(`Bucket can not found.`, HttpStatus.BAD_REQUEST);
    }

    const aggregation = [];

    const supportedLocales = new locale.Locales(
      bucketSettings.language.supported_languages.map(lang => lang.code)
    );
    const locales = new locale.Locales(acceptedLanguage);
    const bestLocale = locales.best(supportedLocales);

    const chosenLocale =
      bestLocale && !bestLocale.defaulted
        ? bestLocale.normalized
        : bucketSettings.language.default.code;

    const fallbackLocale = bucketSettings.language.default.code;

    aggregation.unshift({
      $replaceRoot: {newRoot: this.buildI18nAggregation("$$ROOT", chosenLocale, fallbackLocale)}
    });

    for (const propertyKey in schema.properties) {
      const property = schema.properties[propertyKey];
      if (property.type == "relation") {
        aggregation.push(
          {
            $addFields: {
              [propertyKey]: {
                $convert: {
                  input: `$${propertyKey}`,
                  to: "objectId",
                  onError: "Could not convert to objectId.",
                  onNull: null
                }
              }
            }
          },
          {
            $lookup: {
              from: getBucketDataCollection(property["bucket"]),
              localField: propertyKey,
              foreignField: "_id",
              as: propertyKey
            }
          },
          {
            $addFields: {
              [propertyKey]: {
                $cond: {
                  if: {
                    $eq: [{$size: `$${propertyKey}`}, 1]
                  },
                  then: this.buildI18nAggregation(
                    {$arrayElemAt: [`$${propertyKey}`, 0]},
                    chosenLocale,
                    fallbackLocale
                  ),
                  else: undefined
                }
              }
            }
          },
          {
            $addFields: {
              [`${propertyKey}._id`]: {
                $toString: `$${propertyKey}._id`
              }
            }
          },
          {
            $unwind: {
              path: `$${propertyKey}`,
              preserveNullAndEmptyArrays: true
            }
          }
        );
      }
    }

    if (sort) {
      aggregation.push({
        $sort: sort
      });
    }

    if (filter) {
      aggregation.push({
        $addFields: {
          _id: {
            $toString: `$_id`
          }
        }
      });
      filter instanceof Array ? aggregation.push(...filter) : aggregation.push(filter);
    }

    aggregation.push(
      {
        $facet: {
          meta: [{$count: "total"}],
          data: [{$skip: skip}, {$limit: limit}]
        }
      },
      {
        $project: {
          meta: {$arrayElemAt: ["$meta", 0]},
          data: "$data"
        }
      }
    );

    return this.bds
      .find(bid, prune ? [] : aggregation)
      .then(([row]) => (row ? row : new NotFoundException("Cannot found.")));
  }

  @Get(":id")
  async findOne(
    @Headers("accept-language") acceptedLanguage: string,
    @Param("bid", OBJECT_ID) bid: ObjectId,
    @Query("prune") prune: boolean = false,
    @Param("id", OBJECT_ID) id: ObjectId
  ) {
    const schema = await this.bs.findOne({_id: bid});

    const bucketSettings = await this.bs.getPreferences();

    if (!schema) {
      throw new HttpException(`Bucket can not found.`, HttpStatus.BAD_REQUEST);
    }

    const aggregation = [];

    // TODO(tolga, thesayyn): aggregate relation locale also.
    const supportedLocales = new locale.Locales(
      bucketSettings.language.supported_languages.map(lang => lang.code)
    );
    const locales = new locale.Locales(acceptedLanguage);
    const bestLocale = locales.best(supportedLocales);

    const chosenLocale =
      bestLocale && !bestLocale.defaulted
        ? bestLocale.normalized
        : bucketSettings.language.default.code;

    const fallbackLocale = bucketSettings.language.default.code;

    const constAggregation = {
      $match: {
        _id: id
      }
    };

    aggregation.unshift({
      $replaceRoot: {newRoot: this.buildI18nAggregation("$$ROOT", chosenLocale, fallbackLocale)}
    });

    aggregation.unshift(constAggregation);

    for (const propertyKey in schema.properties) {
      const property = schema.properties[propertyKey];
      if (property.type == "relation") {
        aggregation.push(
          {
            $addFields: {
              [propertyKey]: {
                $convert: {
                  input: `$${propertyKey}`,
                  to: "objectId",
                  onError: "Could not convert to objectId.",
                  onNull: null
                }
              }
            }
          },
          {
            $lookup: {
              from: getBucketDataCollection(property["bucket"]),
              localField: propertyKey,
              foreignField: "_id",
              as: propertyKey
            }
          },
          {
            $addFields: {
              [propertyKey]: {
                $cond: {
                  if: {
                    $eq: [{$size: `$${propertyKey}`}, 1]
                  },
                  then: this.buildI18nAggregation(
                    {$arrayElemAt: [`$${propertyKey}`, 0]},
                    chosenLocale,
                    fallbackLocale
                  ),
                  else: undefined
                }
              }
            }
          },
          {
            $addFields: {
              [`${propertyKey}._id`]: {
                $toString: `$${propertyKey}._id`
              }
            }
          },
          {
            $unwind: {
              path: `$${propertyKey}`,
              preserveNullAndEmptyArrays: true
            }
          }
        );
      }
    }
    return this.bds
      .find(bid, prune ? [constAggregation] : aggregation)
      .then(([row]) => (row ? row : new NotFoundException("Cannot found.")));
  }

  buildI18nAggregation(field: any, locale: string, fallback: string) {
    return {
      $mergeObjects: [
        field,
        {
          $arrayToObject: {
            $map: {
              input: {
                $filter: {
                  input: {
                    $objectToArray: field
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

  @Post()
  @UseGuards(AuthGuard(), ActionGuard("bucket:data:add"))
  replaceOne(
    @Param("bid", OBJECT_ID) bid: ObjectId,
    @Body(Schema.validate(req => `bucket:${req.params.bid}`)) body: BucketEntry
  ) {
    return this.bds.replaceOne(bid, body).then(() => null);
  }

  @Delete(":id")
  @UseGuards(AuthGuard(), ActionGuard("bucket:data:delete"))
  deleteOneData(@Param("bid", OBJECT_ID) bid: ObjectId, @Param("id", OBJECT_ID) id: ObjectId) {
    return this.bds.deleteOne(bid, {_id: id});
  }
}
