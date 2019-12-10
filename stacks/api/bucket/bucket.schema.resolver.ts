import {Injectable} from "@nestjs/common";
import {Validator} from "@spica-server/core/schema";
import {ObjectId} from "@spica-server/database";
import {Bucket} from "./bucket";
import {BucketService} from "./bucket.service";

@Injectable()
export class BucketSchemaResolver {
  constructor(private bucketService: BucketService) {}

  resolve(uri: string): Promise<Bucket | object> | undefined {
    try {
      return this.bucketService.findOne({_id: new ObjectId(uri)}).then(async schema => {
        const prefs = await this.bucketService.getPreferences();
        if (schema) {
          schema["$schema"] = "http://spica.internal/bucket/schema";
          // @ts-ignore
          schema["_id"] = schema["$id"] = String(schema._id);
          // TODO(thesayyn): Accomplish the same behavior with custom keywords
          schema["properties"] = Object.keys(schema["properties"]).reduce(
            (accumulator, key) => {
              const property = schema.properties[key];
              if (property.options.translate) {
                accumulator[key] = {
                  type: "object",
                  required: [prefs.language.default],
                  properties: Object.keys(prefs.language.available).reduce((props, key) => {
                    props[key] = property;
                    return props;
                  }, {}),
                  additionalProperties: false
                };
              } else {
                accumulator[key] = schema.properties[key];
              }
              return accumulator;
            },
            {
              _id: {type: "string", options: {position: undefined}, format: "objectid"},
              _schedule: {type: "string", format: "date-time"}
            }
          ) as any;
          schema["additionalProperties"] = false;
        }
        return schema || {type: true};
      });
    } catch {}
  }
}

export async function provideBucketSchemaResolver(validator: Validator, bs: BucketService) {
  const resolver = new BucketSchemaResolver(bs);
  validator.registerUriResolver(uri => resolver.resolve(uri));
  return resolver;
}
