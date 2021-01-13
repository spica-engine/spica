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
      icon: {
        type: "string"
      },
      components: {
        type: "array",
        items: {
          type: "object",
          required: ["name", "url", "type"],
          properties: {
            name: {
              type: "string"
            },
            url: {
              type: "string"
            },
            type: {
              type: "string"
            }
          },
          additionalProperties: false
        }
      }
    },
    additionalProperties: false
  };
}

export const Dashboard: ResourceDefinition = {
  group: "dashboard",
  names: {
    kind: "Dashboard",
    plural: "dashboards",
    singular: "dashboard",
    shortNames: []
  },
  versions: [
    {
      name: "v1",
      schema: v1.Schema,
      current: true,
      additionalPrinterColumns: [
        {
          name: "name",
          type: "string",
          description: "Name of the dashboard",
          priority: 0,
          jsonPath: ".spec.name"
        },
        {
          name: "status",
          type: "string",
          description: "Status of the dashboard",
          priority: 1,
          jsonPath: ".status"
        }
      ]
    }
  ]
};
