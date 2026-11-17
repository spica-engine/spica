import {JSONSchema7, JSONSchema7Definition} from "json-schema";
import {BadRequestException, Logger} from "@nestjs/common";
import {Bucket, BucketPreferences, ExtendedJSONSchema7Type} from "@spica-server/interface-bucket";
import {ids} from "@spica-server/data";

const logger = new Logger("BucketSchema");

function addIdField(bucket) {
  bucket.properties[ids().keyField(bucket)] = {
    type: "objectid"
  };
  return bucket;
}

export interface CompileOptions {
  /** Optional properties kept in a column may hold null. Everything else stays strict. */
  nullable?: boolean;
  /** Relation values are the target's primary key, so any key type is accepted and the storage decides. */
  relationsByPrimaryKey?: boolean;
}

function holdsNull(schema: JSONSchema7) {
  const kind = schema.type as ExtendedJSONSchema7Type;
  if (!kind || schema["options"]?.translate) {
    return false;
  }
  switch (kind) {
    case "array":
    case "multiselect":
      return !schema.items;
    case "relation":
      return schema["relationType"] != "onetomany";
    case "object":
      return typeof schema.properties != "object";
    default:
      return true;
  }
}

export function compile(
  bucket: Bucket,
  preferences: BucketPreferences,
  options: CompileOptions = {}
): JSONSchema7 {
  function map(
    schema: JSONSchema7,
    nullable = false,
    strictKeys: ReadonlySet<string> = new Set()
  ): JSONSchema7 {
    schema = {...schema};
    const nullableKind = nullable && holdsNull(schema);

    if (typeof schema.properties == "object") {
      const required = new Set(Array.isArray(schema.required) ? schema.required : []);
      for (const key in schema.properties) {
        const spec = schema.properties[key];
        if (typeof spec == "object") {
          schema.properties[key] = map(
            spec,
            Boolean(options.nullable) && !required.has(key) && !strictKeys.has(key)
          );
        } else {
          logger.debug(`ignoring boolean property at ${key}`);
        }
      }
    } else if (schema.items) {
      schema.items = map(schema.items as JSONSchema7);
    }

    switch (schema.type as ExtendedJSONSchema7Type) {
      case "objectid":
        schema.type = "string";
        schema.format = "objectid";
        break;

      case "uuid":
        schema.type = "string";
        schema.format = "uuid";
        break;

      case "bigint":
        schema.type = "string";
        schema.pattern = "^-?\\d+$";
        break;

      case "storage":
      case "richtext":
      case "textarea":
        schema.type = "string";
        break;

      case "hash":
        schema.type = "string";
        schema.format = "hash";
        break;

      case "encrypted":
        schema.type = "string";
        schema.format = "encrypted";
        break;

      case "color":
        schema.type = "string";
        break;

      case "multiselect":
        schema.type = "array";
        schema.uniqueItems = true;
        break;

      case "relation": {
        const key: JSONSchema7 = options.relationsByPrimaryKey
          ? {type: ["string", "integer"]}
          : {type: "string", format: "objectid-string"};
        if (schema["relationType"] == "onetomany") {
          schema.type = "array";
          schema.items = key;
        } else {
          Object.assign(schema, key);
        }

        break;
      }
      case "date":
        schema.type = "string";
        schema.format = "date-time";
        break;

      case "location":
        const point: JSONSchema7Definition = {
          type: "array",
          items: [
            {
              title: "Longitude",
              type: "number",
              minimum: -180,
              maximum: 180
            },
            {
              title: "Latitude",
              type: "number",
              minimum: -90,
              maximum: 90
            }
          ],
          minItems: 2,
          additionalItems: false
        };

        schema.type = "object";
        schema.required = ["coordinates"];
        schema.properties = {
          type: {
            type: "string",
            const: schema["locationType"],
            default: schema["locationType"]
          },
          coordinates: {}
        };

        switch (schema["locationType"]) {
          case "Point":
            schema.properties.coordinates = point;
            break;
          default:
            throw new BadRequestException(
              `Unknown location type '${schema["locationType"]}' on bucket schema.`
            );
        }

        break;

      case "json":
        schema.type = "object";
        break;

      default:
    }

    if (nullableKind && schema.type) {
      const kinds = [schema.type].flat();
      schema.type = (kinds.includes("null") ? kinds : [...kinds, "null"]) as JSONSchema7["type"];
      if (Array.isArray(schema.enum) && !schema.enum.includes(null)) {
        schema.enum = [...schema.enum, null];
      }
    }
    return schema;
  }

  const keyField = ids().keyField(bucket);
  if (keyField && !(keyField in bucket.properties)) {
    bucket = addIdField(bucket);
  }

  const schema = map(
    {
      $schema: "http://json-schema.org/draft-07/schema#",
      required: Array.isArray(bucket.required) ? bucket.required : [],
      readOnly: bucket.readOnly,
      title: bucket.title,
      description: bucket.description,
      type: "object",
      properties: bucket.properties,
      additionalProperties: false
    },
    false,
    new Set(keyField ? [keyField] : [])
  );

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
