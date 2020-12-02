import {JSONSchema7} from "json-schema";
import {ResourceDefinition} from "../../definition";

const TriggerV1: JSONSchema7 = {
  $schema: "http://json-schema.org/draft-07/schema",
  type: "object",
  required: ["name", "type", "func"],
  properties: {
    func: {
      type: "string"
    },
    name: {
      type: "string"
    },
    type: {
      type: "string",
      enum: ["http", "bucket", "schedule", "firehose", "system"]
    },
    scheduleOptions: {
      type: "object",
      required: ["cronSpec", "timezone"],
      properties: {
        cronSpec: {
          type: "string"
        },
        timezone: {
          type: "string"
        }
      }
    },
    firehoseOptions: {
      type: "object",
      required: ["event"],
      properties: {
        event: {
          type: "string"
        }
      }
    },
    httpOptions: {
      type: "object",
      required: ["method", "path"],
      properties: {
        method: {
          type: "string"
        },
        path: {
          type: "string"
        }
      }
    },
    systemOptions: {
      type: "object",
      required: ["event"],
      properties: {
        event: {
          type: "string",
          enum: ["READY"]
        }
      }
    },
    bucketOptions: {
      type: "object",
      required: ["phase"],
      if: {properties: {phase: {const: "BEFORE"}}},
      then: {
        properties: {
          type: {
            enum: ["INSERT", "INDEX", "GET", "UPDATE", "DELETE", "STREAM"]
          }
        }
      },
      else: {
        properties: {
          type: {
            enum: ["ALL", "INSERT", "UPDATE", "DELETE"]
          }
        }
      },
      properties: {
        phase: {
          type: "string",
          enum: ["BEFORE", "AFTER"]
        },
        type: {
          type: "string"
        },
        bucket: {
          type: "object",
          properties: {
            resourceFieldRef: {
              type: "object",
              properties: {
                schemaName: {
                  type: "string"
                }
              }
            }
          }
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
