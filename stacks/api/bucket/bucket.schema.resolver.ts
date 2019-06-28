import {ObjectId} from "@spica-server/database";
import {Injectable} from "@nestjs/common";

import {Bucket} from "./bucket";
import {BucketService} from "./bucket.service";
import {Validator} from "@spica-server/core/schema";

@Injectable()
export class BucketSchemaResolver {
  constructor(private bucketService: BucketService) {}

  resolve(uri: string): Promise<Bucket | object> | undefined {
    const match = /bucket:(.*?)$/g.exec(uri);
    if (match) {
      return this.bucketService.findOne({_id: new ObjectId(match[1])}).then(async schema => {
        const prefs = await this.bucketService.getPreferences();
        if (schema) {
          schema["$schema"] = "http://spica.internal/bucket/schema";
          schema["$id"] = `bucket:${schema._id}`;
          // @ts-ignore
          schema["_id"] = String(schema._id);
          // TODO(thesayyn): Accomplish the same behavior with custom keywords
          schema["properties"] = Object.keys(schema["properties"]).reduce(
            (accumulator, key) => {
              const property = schema.properties[key];
              if (property.options.translate) {
                accumulator[key] = {
                  type: "object",
                  required: [prefs.language.default.code],
                  properties: prefs.language.supported_languages.reduce((props, lang) => {
                    props[lang.code] = property;
                    return props;
                  }, {}),
                  additionalProperties: false
                };
              } else {
                accumulator[key] = schema.properties[key];
              }
              return accumulator;
            },
            {_id: {type: "string", options: {position: undefined}, format: "bucketid"}}
          ) as any;
          schema["additionalProperties"] = false;
        }
        return schema || {type: true};
      });
    }
  }
}

export async function provideBucketSchemaResolver(validator: Validator, bs: BucketService) {
  const resolver = new BucketSchemaResolver(bs);
  validator.registerUriResolver(uri => resolver.resolve(uri));
  return resolver;
}
