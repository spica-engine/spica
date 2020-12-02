import {JSONSchema7} from "json-schema";
import {ResourceDefinition} from "../../definition";

const bucketSchema: JSONSchema7 = {
  $id: "bucket-meta-schema",
  title: "Bucket schema meta-schema",
  definitions: {
    schemaArray: {
      type: "array",
      minItems: 1,
      items: {$ref: "#/definitions/schema"}
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
    },
    schema: {
      type: "object",
       // Bucket relation
       if: {
        properties: {
          type: {
            const: "relation"
          }
        },
      },
      then: {
        required: ["bucket", "relationType"],
        properties: {
          relationType: {
            type: "string",
            enum: ["onetoone", "onetomany"]
          },
          bucket: {
            type: "object",
            required: ["resourceFieldRef"],
            properties: {
              resourceFieldRef: {
                type: "object",
                required: ["schemaName"],
                properties: {
                  schemaName: {type: "string"}
                }
              }
            }
          }
        }
      },
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
          type: "boolean"
          // Unsupported
          // default: false
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
        // additionalItems: {$ref: "#/definitions/schema"},

        items: {
          anyOf: [{$ref: "#/definitions/schema"}, {$ref: "#/definitions/schemaArray"}]
          // Unsupported
          // default: true
        },
        maxItems: {$ref: "#/definitions/nonNegativeInteger"},
        minItems: {$ref: "#/definitions/nonNegativeIntegerDefault0"},
        uniqueItems: {
          type: "boolean"
          // Unsupported
          //default: false
        },

        // Unsupported
        // contains: {$ref: "#/definitions/schema"},

        maxProperties: {$ref: "#/definitions/nonNegativeInteger"},
        minProperties: {$ref: "#/definitions/nonNegativeIntegerDefault0"},
        required: {$ref: "#/definitions/stringArray"},

        // Unsupported
        // additionalProperties: {$ref: "#/definitions/schema"},
        // definitions: {
        //   type: "object",
        //   additionalProperties: {$ref: "#/definitions/schema"},
        //   default: {}
        // },

        properties: {
          type: "object",
          additionalProperties: {$ref: "#/definitions/schema"}
          // Unsupported
          //default: {}
        },

        // Unsupported
        // patternProperties: {
        //   type: "object",
        //   additionalProperties: {$ref: "#/definitions/schema"},
        //   propertyNames: {format: "regex"},
        //   default: {}
        // },

        // Unsupported
        // dependencies: {
        //   type: "object",
        //   additionalProperties: {
        //     anyOf: [{$ref: "#/definitions/schema"}, {$ref: "#/definitions/stringArray"}]
        //   }
        // },

        // Unsupported
        // propertyNames: {$ref: "#/definitions/schema"},
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
        // if: {$ref: "#/definitions/schema"},
        // then: {$ref: "#/definitions/schema"},
        // else: {$ref: "#/definitions/schema"},
        // allOf: {$ref: "#/definitions/schemaArray"},
        // anyOf: {$ref: "#/definitions/schemaArray"},
        // oneOf: {$ref: "#/definitions/schemaArray"},
        // not: {$ref: "#/definitions/schema"}
      }
    }
  },
  // Unsupported
  // type: ["object", "boolean"],
  type: "object",
  required: ["title", "description", "acl"],
  properties: {
    title: {
      type: "string"
    },
    description: {
      type: "string"
    },
    icon: {
      type: "string"
    },
    readOnly: {
      type: "boolean"
    },
    acl: {
      type: "object",
      required: ["write", "read"],
      properties: {
        write: {
          type: "string"
        },
        read: {
          type: "string"
        }
      }
    },
    properties: {
      patternProperties: {
        "": {
          allOf: [
            {$ref: "#/definitions/schema"},
            {
              type: "object",
              properties: {
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
                      type: "string",
                      enum: ["left", "right", "bottom"]
                    }
                  }
                }
              }
            }
          ]
        }
      }
    }
  }

  // Unsupported
  // default: true
};

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
      schema: bucketSchema,
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
