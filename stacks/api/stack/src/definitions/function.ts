import {JSONSchema7} from "json-schema";
import {ResourceDefinition} from "../definition";

const SchemaV1: JSONSchema7 = {
  $schema: "http://json-schema.org/draft-07/schema",
  $id: "http://example.com/example.json",
  type: "object",
  required: [
    "title",
    "description",
    "timeout",
    "runtime",
    "dependencies",
    "trigger",
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
      required: ["name", "version", "language"],
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
    dependencies: {
      $id: "#/properties/dependencies",
      type: "array",
      items: {
        $id: "#/properties/dependencies/items",
        type: "object",
        required: ["name", "version"],
        properties: {
          name: {
            $id: "#/properties/dependencies/items/properties/name",
            type: "string"
          },
          version: {
            $id: "#/properties/dependencies/items/properties/version",
            type: "string"
          }
        }
      }
    },
    trigger: {
      $id: "#/properties/trigger",
      type: "array",
      items: {
        $id: "#/properties/trigger/items",
        type: "object",
        required: ["name", "type", "options"],
        properties: {
          name: {
            $id: "#/properties/trigger/items/properties/name",
            type: "string"
          },
          type: {
            $id: "#/properties/trigger/items/properties/type",
            type: "string"
          },
          options: {
            $id: "#/properties/trigger/items/properties/options",
            type: "object",
            required: []
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
    shortnames: ["fn", "function"]
  },
  versions: [
    {
      name: "v1",
      schema: SchemaV1,
      current: true,
      additionalPrinterColumns: [
        {
          name: "title",
          type: "string",
          description: "",
          jsonPath: ".spec.title"
        },
        {
          name: "runtime",
          type: "string",
          description: "",
          jsonPath: ".spec.runtime.name"
        },
        {
          name: "runtime version",
          type: "string",
          description: "",
          jsonPath: ".spec.runtime.version"
        },
        {
          name: "language",
          type: "string",
          description: "",
          jsonPath: ".spec.runtime.language"
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
