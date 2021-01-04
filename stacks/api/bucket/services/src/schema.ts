import {JSONSchema7} from "json-schema";
import {Bucket, BucketPreferences} from "./bucket";

export function compile(bucket: Bucket, preferences: BucketPreferences): JSONSchema7 {
  function map(schema: JSONSchema7): JSONSchema7 {
    schema = {...schema};
    if (typeof schema.properties == "object") {
      for (const key in schema.properties) {
        const spec = schema.properties[key];
        if (typeof spec == "object") {
          schema.properties[key] = map(spec);
        } else {
          console.debug(`ignoring boolean property at ${key}`);
        }
      }
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

  const schema = map({
    $schema: "http://json-schema.org/draft-07/schema#",
    required: Array.isArray(bucket.required) ? bucket.required : [],
    readOnly: bucket.readOnly,
    title: bucket.title,
    description: bucket.description,
    type: "object",
    properties: bucket.properties,
    additionalProperties: false
  });

  schema.properties = Object.keys(bucket.properties).reduce((accumulator, key) => {
    let property: any = {...bucket.properties[key]};

    if (property.options && property.options.translate) {
      property = {
        type: "object",
        required: [preferences.language.default],
        properties: Object.keys(preferences.language.available).reduce((props, key) => {
          props[key] = property;
          return props;
        }, {}),
        additionalProperties: false
      };
    }
    delete property.options;
    accumulator[key] = property;
    return accumulator;
  }, {});

  return schema;
}
