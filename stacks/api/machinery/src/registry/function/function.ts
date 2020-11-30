import {JSONSchema7} from "json-schema";
import {ResourceDefinition} from "../../definition";

const FunctionV1: JSONSchema7 = {
  $schema: "http://json-schema.org/draft-07/schema",
  type: "object",
  required: ["title", "description", "timeout", "runtime"],
  properties: {
    title: {
      type: "string"
    },
    description: {
      type: "string"
    },
    timeout: {
      type: "integer",
      default: 10
    },
    runtime: {
      type: "object",
      required: ["name", "language", "version"],
      properties: {
        name: {
          type: "string",
          enum: ["Node"],
          default: "Node"
        },
        version: {
          type: "string",
          default: "default"
        },
        language: {
          type: "string",
          enum: ["Javascript", "Typescript"]
        }
      }
    },
    dependency: {
      type: "array",
      default: [],
      items: {
        type: "object",
        required: ["name", "version"],
        properties: {
          name: {
            type: "string"
          },
          version: {
            type: "string"
          }
        }
      }
    },
    environment: {
      type: "array",
      default: [],
      items: {
        type: "object",
        required: ["name"],
        oneOf: [{required: ["value"]}, {required: ["valueFrom"]}],
        properties: {
          name: {
            type: "string"
          },
          value: {
            type: "string"
          },
          valueFrom: {
            type: "object",
            required: ["resourceFieldRef"],
            properties: {
              resourceFieldRef: {
                type: "object",
                oneOf: [{required: ["schemaName"]}, {required: ["apiKeyName"]}],
                properties: {
                  bucketName: {
                    type: "string"
                  },
                  apiKeyName: {
                    type: "string"
                  }
                }
              }
            }
          }
        }
      }
    }
  }
};

export const Function: ResourceDefinition = {
  group: "function",
  names: {
    kind: "Function",
    plural: "functions",
    singular: "function",
    shortNames: ["fn", "function"]
  },
  versions: [
    {
      name: "v1",
      schema: FunctionV1,
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
          name: "runtime",
          type: "string",
          description: "",
          jsonPath: ".spec.runtime.name",
          priority: 0
        },
        {
          name: "runtime version",
          type: "string",
          description: "",
          jsonPath: ".spec.runtime.version",
          priority: 0
        },
        {
          name: "language",
          type: "string",
          description: "",
          jsonPath: ".spec.runtime.language",
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
