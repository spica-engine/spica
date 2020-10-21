import {ResourceDefinition} from "../../definition";

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
      schema: undefined,
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
