import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  InternalServerErrorException,
  NotFoundException,
  Param,
  Post,
  Query,
  UseGuards
} from "@nestjs/common";
import {BOOLEAN, DEFAULT, JSONP, NUMBER} from "@spica-server/core";
import {Schema} from "@spica-server/core/schema";
import {FilterQuery, MongoError, ObjectId, OBJECT_ID} from "@spica-server/database";
import {ActionGuard, AuthGuard} from "@spica-server/passport";
import * as locale from "locale";
import {BucketDocument} from "./bucket";
import {BucketDataService, getBucketDataCollection} from "./bucket-data.service";
import {BucketService} from "./bucket.service";

@Controller("bucket/:bucketId/data")
export class BucketDataController {
  constructor(private bs: BucketService, private bds: BucketDataService) {}

  private async getLanguage(language: string) {
    const bucketSettings = await this.bs.getPreferences();

    const supportedLocales = new locale.Locales(
      bucketSettings.language.supported_languages.map(lang => lang.code)
    );
    const locales = new locale.Locales(language);
    const bestLocale = locales.best(supportedLocales);

    const best =
      bestLocale && !bestLocale.defaulted
        ? bestLocale.normalized
        : bucketSettings.language.default.code;

    const fallback = bucketSettings.language.default.code;

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

  private buildRelationAggreation(
    property: string,
    bucketId: string,
    locale: {best: string; fallback: string}
  ) {
    return [
      {
        $lookup: {
          from: getBucketDataCollection(bucketId),
          let: {
            documentId: {
              $convert: {
                input: `$${property}`,
                to: "objectId"
              }
            }
          },
          pipeline: [
            {$match: {$expr: {_id: "$$documentId"}}},
            {$replaceWith: this.buildI18nAggregation("$$ROOT", locale.best, locale.fallback)},
            {$set: {_id: {$toString: "$_id"}}}
          ],
          as: property
        }
      },
      {$unwind: `$${property}`}
    ];
  }

  @Get()
  async find(
    @Param("bucketId", OBJECT_ID) bucketId: ObjectId,
    @Headers("accept-language") acceptedLanguage: string,
    @Query("relation", DEFAULT(false), BOOLEAN) relation: boolean = false,
    @Query("paginate", DEFAULT(false), BOOLEAN) paginate: boolean = false,
    @Query("localize", DEFAULT(true), BOOLEAN) localize: boolean = true,
    @Query("filter", JSONP) filter: FilterQuery<BucketDocument>,
    @Query("limit", NUMBER) limit: number,
    @Query("skip", NUMBER) skip: number,
    @Query("sort", JSONP) sort: object
  ) {
    const aggregation = [];

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
            ...this.buildRelationAggreation(propertyKey, property["bucket"], locale)
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

    if (sort) {
      aggregation.push({
        $sort: sort
      });
    }

    if (skip) {
      aggregation.push({$skip: skip});
    }

    if (limit) {
      aggregation.push({$limit: limit});
    }

    const documents = await this.bds
      .find(bucketId, aggregation)
      .catch((error: MongoError) =>
        Promise.reject(new InternalServerErrorException(`${error.message}; code ${error.code}.`))
      );

    return paginate != false
      ? {meta: {total: await this.bds.documentCount(bucketId)}, data: await documents}
      : documents;
  }

  @Get(":documentId")
  async findOne(
    @Headers("accept-language") acceptedLanguage: string,
    @Param("bucketId", OBJECT_ID) bucketId: ObjectId,
    @Param("documentId", OBJECT_ID) documentId: ObjectId,
    @Query("localize", DEFAULT(true), BOOLEAN) localize: boolean = true,
    @Query("relation", DEFAULT(false), BOOLEAN) relation: boolean = false
  ) {
    const aggregation = [];

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
            ...this.buildRelationAggreation(propertyKey, property["bucket"], locale)
          );
        }
      }
    }

    const [document] = await this.bds.find(bucketId, aggregation);

    if (!document) {
      throw new NotFoundException(`${documentId} could not be found.`);
    }

    return document;
  }

  @Post()
  @UseGuards(AuthGuard(), ActionGuard(["bucket:data:add"]))
  replaceOne(
    @Param("bucketId", OBJECT_ID) bucketId: ObjectId,
    @Body(Schema.validate(req => req.params.bucketId)) body: BucketDocument
  ) {
    return this.bds.replaceOne(bucketId, body).then(() => null);
  }

  @Delete(":documentId")
  @UseGuards(AuthGuard(), ActionGuard("bucket:data:delete"))
  deleteOne(
    @Param("bucketId", OBJECT_ID) bucketId: ObjectId,
    @Param("documentId", OBJECT_ID) documentId: ObjectId
  ) {
    return this.bds.deleteOne(bucketId, {_id: documentId});
  }

  @Delete()
  @UseGuards(AuthGuard(), ActionGuard("bucket:data:delete"))
  deleteMany(@Param("bucketId", OBJECT_ID) bucketId: ObjectId, @Body() body) {
    return this.bds.deleteMany(bucketId, body);
  }
}
