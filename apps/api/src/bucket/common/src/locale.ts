import {BucketDataService, BucketService} from "@spica-server/bucket/services";
import locale from "locale";
import {ChangeKind, diff} from "@spica-server/core/differ";
import {BucketCacheService} from "@spica-server/bucket/cache";
import {Locale} from "@spica-server/interface/bucket/common";
import {Bucket, BucketPreferences} from "@spica-server/interface/bucket/services";

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

export function findLocale(language: string, preferences: BucketPreferences): Locale {
  const supportedLocales = new locale.Locales(Object.keys(preferences.language.available));
  const locales = new locale.Locales(language);
  const bestLocale = locales.best(supportedLocales);

  const best =
    bestLocale && !bestLocale.defaulted ? bestLocale.normalized : preferences.language.default;

  const fallback = preferences.language.default;

  return {best, fallback};
}

export function hasTranslatedProperties(schema: Bucket) {
  for (const property in schema.properties) {
    const definition = schema.properties[property];
    if (definition.options && definition.options.translate) {
      return true;
    }
  }
  return false;
}

export function provideLanguageFinalizer(
  bucketService: BucketService,
  bucketDataService: BucketDataService,
  bucketCacheService?: BucketCacheService
) {
  return async (previousSchema: object, currentSchema: object) => {
    const deletedLanguages = diff(previousSchema, currentSchema)
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

    const buckets = await bucketService
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

    const promises = [];

    for (const bucket of buckets) {
      if (bucketCacheService) {
        await bucketCacheService.invalidate(bucket._id.toHexString());
      }

      const targets = {};

      for (const fieldName of Object.keys(bucket.properties)) {
        for (const language of deletedLanguages) {
          const target = fieldName + "." + language;
          targets[target] = "";
        }
      }

      promises.push(bucketDataService.children(bucket).updateMany({}, {$unset: targets}));
    }

    return Promise.all(promises);
  };
}
