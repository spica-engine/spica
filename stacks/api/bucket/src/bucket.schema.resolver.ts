import {Injectable} from "@nestjs/common";
import {BucketService, compile} from "@spica-server/bucket/services";
import {Bucket} from "@spica-server/bucket/services/bucket";
import {Validator} from "@spica-server/core/schema";
import {ObjectId} from "@spica-server/database";
import {filter} from "rxjs/operators";
import {getUpdatedLanguages} from "./utility";

@Injectable()
export class BucketSchemaResolver {
  constructor(private bucketService: BucketService) {}

  resolve(uri: string): Promise<Bucket | object> | undefined {
    if (ObjectId.isValid(uri)) {
      return this.bucketService.findOne({_id: new ObjectId(uri)}).then(async schema => {
        const prefs = await this.bucketService.getPreferences();
        if (schema) {
          const jsonSchema = compile(schema, prefs);
          jsonSchema.$id = uri;
          jsonSchema.$schema = "http://spica.internal/bucket/schema";
          jsonSchema.additionalProperties = false;
          jsonSchema.properties._schedule = {
            type: "string",
            format: "date-time"
          };
        }
        return schema || {type: true};
      });
    }
  }
}

export async function provideBucketSchemaResolver(validator: Validator, bs: BucketService) {
  const resolver = new BucketSchemaResolver(bs);
  registerPreferenceWatcher(bs, validator);
  validator.registerUriResolver(uri => resolver.resolve(uri));
  return resolver;
}

export function registerPreferenceWatcher(bs: BucketService, validator: Validator) {
  let previousPrefs = {};
  let isInitialState = true;
  bs.watchPreferences(true)
    .pipe(
      filter(currentPrefs => {
        let hasChanges = false;

        if (isInitialState) {
          isInitialState = false;
        } else if (!isInitialState && getUpdatedLanguages(previousPrefs, currentPrefs).length) {
          hasChanges = true;
        }
        previousPrefs = currentPrefs;
        return hasChanges;
      })
    )
    .subscribe(_ =>
      bs
        .aggregate([
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
                $arrayToObject: "$properties"
              }
            }
          }
        ])
        .toArray()
        .then(buckets => {
          buckets.forEach(bucket => {
            validator.removeSchema(bucket._id.toHexString());
          });
        })
    );
}
