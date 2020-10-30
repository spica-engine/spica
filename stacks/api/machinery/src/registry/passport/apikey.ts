import {JSONSchema7} from "json-schema";
import {ResourceDefinition} from "../../definition";

export namespace v1 {
  export const Schema: JSONSchema7 = {
    $schema: "http://json-schema.org/draft-07/schema#",
    type: "object",
    required: ["name"],
    properties: {
      name: {
        type: "string"
      },
      description: {
        type: "string"
      }
    },
    additionalProperties: false
  };
}

export const ApiKey: ResourceDefinition = {
  group: "passport",
  names: {
    kind: "ApiKey",
    plural: "apikeys",
    singular: "apikey",
    shortNames: []
  },
  versions: [
    {
      name: "v1",
      schema: v1.Schema,
      current: true,
      additionalPrinterColumns: [
        {
          name: "TITLE",
          type: "string",
          description: "Title of the key",
          jsonPath: ".spec.name",
          priority: 0
        },
        {
          name: "KEY",
          type: "string",
          format: "password",
          description: "Immutable access key",
          jsonPath: ".spec.key",
          priority: 0
        },
        {
          name: "status",
          type: "string",
          description: "Status of the key",
          priority: 1,
          jsonPath: ".status"
        }
      ]
    }
  ]
};
