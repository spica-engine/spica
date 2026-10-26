import locale from "locale";
import {diff} from "@spica-server/core-differ";
import {ChangeKind} from "@spica-server/interface-core";
import {BucketCacheService} from "@spica-server/bucket-cache";
import {Locale} from "@spica-server/interface-bucket-common";
import {
  Bucket,
  BucketDataRepository,
  BucketPreferences,
  BucketRepository
} from "@spica-server/interface-bucket";

export function findLocale(language: string, preferences: BucketPreferences): Locale {
  const supportedLocales = new locale.Locales(Object.keys(preferences.language.available));
  const locales = new locale.Locales(language);
  const bestLocale = locales.best(supportedLocales);

  const best =
    bestLocale && !bestLocale.defaulted ? bestLocale.normalized : preferences.language.default;

  const fallback = preferences.language.default;

  return {best, fallback};
}

export function setContentLanguage(req: any, locale?: Locale) {
  if (locale) {
    req.res.header("Content-language", locale.best || locale.fallback);
  }
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
  buckets: BucketRepository,
  bucketData: BucketDataRepository,
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
      .map(change => String(change.path[2]));

    if (!deletedLanguages.length) {
      return Promise.resolve();
    }

    const translatableBuckets = await buckets.findTranslatable();

    const promises = [];

    for (const bucket of translatableBuckets) {
      if (bucketCacheService) {
        await bucketCacheService.invalidate(bucket._id.toString());
      }

      const targets: string[][] = [];

      for (const fieldName of Object.keys(bucket.properties)) {
        for (const language of deletedLanguages) {
          targets.push([fieldName, language]);
        }
      }

      promises.push(bucketData.unsetFields(bucket, targets));
    }

    return Promise.all(promises);
  };
}
