import {Bucket, BucketPreferences, BucketService} from "@spica-server/bucket/services";
import {JSONSchema7} from "json-schema";
import * as locale from "locale";
import {ChangeKind, diff} from "../history/differ";
import {BucketDataService} from "./bucket-data.service";

export function buildI18nAggregation(property: any, locale: string, fallback: string) {
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

export interface Locale {
  best: string;
  fallback: string;
}

export function findLocale(language: string, preferences: BucketPreferences): Locale {
  const supportedLocales = new locale.Locales(Object.keys(preferences.language.available));
  const locales = new locale.Locales(language);
  const bestLocale = locales.best(supportedLocales);

  const best =
    bestLocale && !bestLocale.defaulted ? bestLocale.normalized : preferences.language.default;

  const fallback = preferences.language.default;

  return {best, fallback};
}

export function hasTranslatedProperties(properties: JSONSchema7) {
  return Object.values(properties).some(property => property.options && property.options.translate);
}

export function hasRelationalProperties(properties: JSONSchema7) {
  return Object.values(properties).some(value => value.type == "relation");
}

export function provideLanguageChangeUpdater(
  bucketService: BucketService,
  bucketDataService: BucketDataService
) {
  return async (previousSchema: object, currentSchema: object) => {
    let deletedLanguages = diff(previousSchema, currentSchema)
      .filter(
        change =>
          change.kind == ChangeKind.Delete &&
          change.path[0] == "language" &&
          change.path[1] == "available"
      )
      .map(change => change.path[2]);

    if (!deletedLanguages.length) {
      return Promise.resolve();
    }

    let buckets = await bucketService
      .aggregate<Bucket>([
        {
          $project: {
            properties: {
              $objectToArray: "$properties"
            }
          }
        },
        {
          $match: {
            "properties.v.options.translate": true
          }
        },
        {
          $project: {
            properties: {
              $filter: {
                input: "$properties",
                as: "property",
                cond: {$eq: ["$$property.v.options.translate", true]}
              }
            }
          }
        },
        {
          $project: {
            properties: {
              $arrayToObject: "$properties"
            }
          }
        }
      ])
      .toArray();

    let promises = buckets.map(bucket => {
      let targets = {};

      Object.keys(bucket.properties).forEach(field => {
        targets = deletedLanguages.reduce((acc, language) => {
          acc = {...acc, [`${field}.${language}`]: ""};
          return acc;
        }, targets);
      });

      return bucketDataService.children(bucket._id).updateMany({}, {$unset: targets});
    });

    return Promise.all(promises);
  };
}
