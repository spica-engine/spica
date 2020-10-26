import {JSONSchema7} from "json-schema";
import { ResourceDefinition } from "../../definition";


const FunctionV1: JSONSchema7 = {
  $schema: "http://json-schema.org/draft-07/schema",
  $id: "http://example.com/example.json",
  type: "object",
  required: [
    "title",
    "description",
    "timeout",
    "runtime",
    "dependency",
    "environment"
  ],
  properties: {
    title: {
      $id: "#/properties/title",
      type: "string"
    },
    description: {
      $id: "#/properties/description",
      type: "string"
    },
    timeout: {
      $id: "#/properties/timeout",
      type: "integer"
    },
    runtime: {
      $id: "#/properties/runtime",
      type: "object",
      required: ["name", "language"],
      properties: {
        name: {
          $id: "#/properties/runtime/properties/name",
          type: "string"
        },
        version: {
          $id: "#/properties/runtime/properties/version",
          type: "string"
        },
        language: {
          $id: "#/properties/runtime/properties/language",
          type: "string"
        }
      }
    },
    dependency: {
      $id: "#/properties/dependency",
      type: "array",
      items: {
        $id: "#/properties/dependency/items",
        type: "object",
        required: ["name", "version"],
        properties: {
          name: {
            $id: "#/properties/dependency/items/properties/name",
            type: "string"
          },
          version: {
            $id: "#/properties/dependency/items/properties/version",
            type: "string"
          }
        }
      }
    },
    environment: {
      $id: "#/properties/environment",
      type: "array",
      items: {
        $id: "#/properties/environment/items",
        type: "object",
        required: ["name", "value"],
        properties: {
          name: {
            $id: "#/properties/environment/items/properties/name",
            type: "string"
          },
          value: {
            $id: "#/properties/environment/items/properties/value",
            type: "string"
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
          priority: 0,
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
