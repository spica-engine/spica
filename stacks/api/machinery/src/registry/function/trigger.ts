import {JSONSchema7} from "json-schema";
import {ResourceDefinition} from "../../definition";

const TriggerV1: JSONSchema7 = {
  $schema: "http://json-schema.org/draft-07/schema",
  $id: "#/items",
  type: "object",
  properties: {
    name: {
      $id: "#/items/properties/name",
      type: "string"
    },
    active: {
      $id: "#/items/properties/active",
      type: "boolean"
    },
    type: {
      $id: "#/items/properties/type",
      type: "string",
      enum: ["http"]
    },
    httpOptions: {
      $id: "#/items/properties/httpOptions",
      type: "object",
      required: [],
      properties: {
        method: {
          $id: "#/items/properties/httpOptions/properties/method",
          type: "string"
        },
        path: {
          $id: "#/items/properties/httpOptions/properties/path",
          type: "string"
        }
      }
    }
  }
};

export const Trigger: ResourceDefinition = {
  group: "function",
  names: {
    kind: "Trigger",
    plural: "triggers",
    singular: "trigger",
    shortNames: ["trigger"]
  },
  versions: [
    {
      name: "v1",
      schema: TriggerV1,
      current: true,
      additionalPrinterColumns: [
        {
          name: "TYPE",
          description: "Type of the trigger",
          jsonPath: ".spec.type",
          priority: 0,
          type: "string"
        },
        {
          name: "HANDLER",
          description: "Name of the handler to invoke",
          jsonPath: ".spec.name",
          priority: 0,
          type: "string"
        }
      ]
    }
  ]
};
