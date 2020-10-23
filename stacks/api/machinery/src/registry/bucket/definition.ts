import {JSONSchema7, JSONSchema7Definition} from "json-schema";
import {ResourceDefinition} from "../../definition";

const bucketSchema:JSONSchema7Definition = { 
  $id: "bucket-meta-schema",
  title: "Bucket schema meta-schema",
  definitions: {
    schemaArray: {
      type: "array",
      minItems: 1,
      items: {$ref: "#"}
    },
    nonNegativeInteger: {
      type: "integer",
      minimum: 0
    },
    nonNegativeIntegerDefault0: {
      allOf: [{$ref: "#/definitions/nonNegativeInteger"}, {default: 0}]
    },
    simpleTypes: {
      enum: [
        "array",
        "boolean",
        // unsupported
        // "integer",
        // "null",
        "number",
        "object",
        "string",
        // supported by bucket.
        "storage",
        "richtext",
        "date",
        "textarea",
        "color",
        "relation",
        "location"
      ]
    },
    stringArray: {
      type: "array",
      items: {type: "string"},
      uniqueItems: true,
      default: []
    }
  },
  // Unsupported
  // type: ["object", "boolean"],
  type: "object",
  properties: {
    // Unsupported
    // $id: {
    //   type: "string",
    //   format: "uri-reference"
    // },
    // $schema: {
    //   type: "string",
    //   format: "uri"
    // },
    // $ref: {
    //   type: "string",
    //   format: "uri-reference"
    // },
    $comment: {
      type: "string"
    },
    title: {
      type: "string"
    },
    description: {
      type: "string"
    },
    default: true,
    readOnly: {
      type: "boolean",
      default: false
    },
    examples: {
      type: "array",
      items: true
    },
    // Unsupported
    // multipleOf: {
    //   type: "number",
    //   exclusiveMinimum: 0
    // },
    maximum: {
      type: "number"
    },

    // Unsupported
    // exclusiveMaximum: {
    //   type: "number"
    // },

    minimum: {
      type: "number"
    },

    // Unsupported
    // exclusiveMinimum: {
    //   type: "number"
    // },

    maxLength: {$ref: "#/definitions/nonNegativeInteger"},
    minLength: {$ref: "#/definitions/nonNegativeIntegerDefault0"},
    pattern: {
      type: "string",
      format: "regex"
    },

    // Unsupported
    // additionalItems: {$ref: "#"},

    items: {
      anyOf: [{$ref: "#"}, {$ref: "#/definitions/schemaArray"}],
      // Unsupported
      // default: true
    },
    maxItems: {$ref: "#/definitions/nonNegativeInteger"},
    minItems: {$ref: "#/definitions/nonNegativeIntegerDefault0"},
    uniqueItems: {
      type: "boolean",
      default: false
    },

    // Unsupported
    // contains: {$ref: "#"},

    maxProperties: {$ref: "#/definitions/nonNegativeInteger"},
    minProperties: {$ref: "#/definitions/nonNegativeIntegerDefault0"},
    required: {$ref: "#/definitions/stringArray"},

    // Unsupported
    // additionalProperties: {$ref: "#"},
    // definitions: {
    //   type: "object",
    //   additionalProperties: {$ref: "#"},
    //   default: {}
    // },

    properties: {
      type: "object",
      additionalProperties: {$ref: "#"},
      default: {}
    },

    // Unsupported
    // patternProperties: {
    //   type: "object",
    //   additionalProperties: {$ref: "#"},
    //   propertyNames: {format: "regex"},
    //   default: {}
    // },

    // Unsupported
    // dependencies: {
    //   type: "object",
    //   additionalProperties: {
    //     anyOf: [{$ref: "#"}, {$ref: "#/definitions/stringArray"}]
    //   }
    // },

    // Unsupported
    // propertyNames: {$ref: "#"},
    // const: true,

    enum: {
      type: "array",
      items: true,
      minItems: 1,
      uniqueItems: true
    },

    // Unsupported
    // type: {
    //   anyOf: [
    //     {$ref: "#/definitions/simpleTypes"},
    //     {
    //       type: "array",
    //       items: {$ref: "#/definitions/simpleTypes"},
    //       minItems: 1,
    //       uniqueItems: true
    //     }
    //   ]
    // },
    type: {$ref: "#/definitions/simpleTypes"},
    format: {type: "string"}

    // Not supported.
    // contentMediaType: {type: "string"},
    // contentEncoding: {type: "string"},
    // if: {$ref: "#"},
    // then: {$ref: "#"},
    // else: {$ref: "#"},
    // allOf: {$ref: "#/definitions/schemaArray"},
    // anyOf: {$ref: "#/definitions/schemaArray"},
    // oneOf: {$ref: "#/definitions/schemaArray"},
    // not: {$ref: "#"}
  },

  // Unsupported
  // default: true
};

export namespace v1 {
  export const SchemaSchema: JSONSchema7 = {
    type: 'object',
    properties: {
      properties: {
        patternProperties: {
          "^[a-zA-Z_\\-][a-zA-Z_\\-0-9]*$": {
            $ref: "bucket-meta-schema"
          }
        }
      }
    }
  };

  export type Schema = any;
}

export const Bucket: ResourceDefinition = {
  group: "bucket",
  names: {
    kind: "Schema",
    plural: "schemas",
    singular: "schema",
    shortNames: ["b", "bkt"]
  },
  versions: [
    {
      name: "v1",
      schema: v1.SchemaSchema,
      additionalSchemas: [bucketSchema],
      current: true,
      additionalPrinterColumns: [
        {
          name: "title",
          type: "string",
          description: "",
          jsonPath: ".spec.title",
          priority: 0
        },
        {
          name: "description",
          type: "string",
          description: "",
          jsonPath: ".spec.description",
          priority: 0
        },
        {
          name: "status",
          type: "string",
          description: "",
          jsonPath: ".status"
        }
      ]
    }
  ]
};
