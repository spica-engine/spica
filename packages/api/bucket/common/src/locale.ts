import {BucketDataService, BucketService} from "@spica-server/bucket-services";
import locale from "locale";
import {diff} from "@spica-server/core-differ";
import {ChangeKind} from "@spica-server/interface-core";
import {BucketCacheService} from "@spica-server/bucket-cache";
import {Locale} from "@spica-server/interface-bucket-common";
import {Bucket, BucketPreferences} from "@spica-server/interface-bucket";

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

    /**
     * The buckets that have a translatable property — filtered **in the application layer**.
     *
     * An aggregation used to run with a `$objectToArray` + `$filter` + `$arrayToObject` chain. That chain's
     * only job was asking the database "is there anything in the properties map with `options.translate`";
     * the schema is already in memory and `hasTranslatedProperties` sits right above. The right move is to
     * **remove** a Mongo-specific escape hatch rather than move it into a finite compiler (
     * a gradual move to `read()`).
     *
     * The number of buckets is in the dozens and they are cached anyway; this is faster than the
     * `$objectToArray` gymnastics too.
     */
    const buckets = (await bucketService.find()).filter(hasTranslatedProperties);

    const promises = [];

    for (const bucket of buckets) {
      if (bucketCacheService) {
        await bucketCacheService.invalidate(bucket._id.toHexString());
      }

      const targets = {};

      // Translatable fields only: the aggregation used to narrow `properties` down the same way.
      for (const [fieldName, definition] of Object.entries(bucket.properties)) {
        if (!definition.options?.translate) continue;
        for (const language of deletedLanguages) {
          targets[`${fieldName}.${language}`] = "";
        }
      }

      promises.push(bucketDataService.children(bucket).updateMany({}, {$unset: targets}));
    }

    return Promise.all(promises);
  };
}
