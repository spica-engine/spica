import {JSONSchema7} from "json-schema";
import {Bucket, BucketPreferences} from "./bucket";

export function compile(schema: Bucket, preferences: BucketPreferences): JSONSchema7 {
  function map(schema: JSONSchema7): JSONSchema7 {
    if (schema.properties) {
      Object.keys(schema.properties).forEach(
        key => (schema.properties[key] = map(schema.properties[key] as JSONSchema7))
      );
    } else if (schema.items) {
      schema.items = map(schema.items as JSONSchema7);
    } else {
      switch (schema.type) {
        case "storage":
        case "richtext":
        case "textarea":
          schema.type = "string";
          break;
        case "color":
          schema.type = "string";
          break;
        case "relation":
          if (schema["relationType"] == "onetomany") {
            schema.type = "array";
            schema.items = {
              format: "objectid-string",
              type: "string"
            };
          } else {
            schema.type = "string";
            schema.format = "objectid-string";
          }

          break;
        case "date":
          schema.type = "string";
          schema.format = "date-time";
          break;
        case "location":
          schema.type = "object";
          schema.required = ["longitude", "latitude"];
          schema.properties = {
            longitude: {
              title: "Longitude",
              type: "number",
              minimum: -180,
              maximum: 180
            },
            latitude: {
              title: "Latitude",
              type: "number",
              minimum: -90,
              maximum: 90
            }
          };
          break;
        default:
      }
    }
    return schema;
  }

  const bucket = map(schema as unknown) as Bucket;

  delete bucket._id;
  delete bucket.icon;
  delete bucket.order;
  delete bucket.primary;

  bucket.properties = Object.keys(bucket.properties).reduce((accumulator, key) => {
    let property = schema.properties[key];
    if (property.options && property.options.translate) {
      accumulator[key] = {
        type: "object",
        required: [preferences.language.default],
        properties: Object.keys(preferences.language.available).reduce((props, key) => {
          props[key] = property;
          return props;
        }, {}),
        additionalProperties: false
      };
    } else {
      accumulator[key] = schema.properties[key];
    }
    delete property.options;
    return accumulator;
  }, {});
  return bucket as JSONSchema7;
}
