import { JSONSchema7 } from "json-schema";
import {ResourceDefinition} from "../definition";

const SchemaV1: JSONSchema7 = {
  $schema: "http://json-schema.org/draft-07/schema",
  type: "object",
  required: ["title", "description", "properties"],
  definitions: {
    property: {
      type: "object",
      properties: {
        type: {
          type: "string",
          enum: [
            "storage",
            "richtext",
            "string",
            "object",
            "number",
            "boolean",
            "date",
            "textarea",
            "array",
            "color",
            "relation",
            "location"
          ]
        },
        options: {
          type: "object",
          properties: {
            visible: {
              type: "boolean"
            },
            translate: {
              type: "boolean"
            },
            history: {
              type: "boolean"
            },
            position: {
              type: "string"
            }
          }
        }
      }
    }
  },
  properties: {
    history: {
      type: "boolean",
      default: false
    },
    title: {
      type: "string",
      maxLength: 100,
      minLength: 4
    },
    description: {
      type: "string",
      minLength: 1,
      maxLength: 500
    },
    icon: {
      type: "string",
      default: "view_stream"
    },
    primary: {
      type: "string"
    },
    order: {
      type: "number"
    },
    required: {
      type: "array",
      uniqueItems: true,
      items: {
        type: "string"
      }
    },
    readOnly: {
      type: "boolean"
    },
    properties: {
      type: "object",
      additionalProperties: {
        oneOf: [
          {$ref: "#/definitions/property"},
          {$ref: "http://json-schema.org/draft-07/schema"}
        ]
      }
    }
  },
  additionalProperties: false
};

export const Bucket: ResourceDefinition = {
  group: "",
  names: {
    kind: "Bucket",
    plural: "buckets",
    singular: "bucket",
    shortnames: ["b", "bkt"]
  },
  versions: [
    {
      name: "v1",
      schema: SchemaV1
    }
  ]
};
