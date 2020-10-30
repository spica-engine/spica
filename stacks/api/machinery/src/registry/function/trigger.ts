import {JSONSchema7} from "json-schema";
import {ResourceDefinition} from "../../definition";

const TriggerV1: JSONSchema7 = {
  $schema: "http://json-schema.org/draft-07/schema",
  type: "object",
  required: ["name", "type", "func"],
  properties: {
    func: {
      $id: "#/properties/func",
      type: "string"
    },
    name: {
      $id: "#/properties/name",
      type: "string"
    },
    type: {
      $id: "#/properties/type",
      type: "string",
      enum: ["http", "bucket", "schedule", "firehose", "system"]
    },
    scheduleOptions: {
      $id: "#/properties/scheduleOptions",
      type: "object",
      required: ["cronSpec", "timezone"],
      properties: {
        cronSpec: {
          $id: "#/properties/scheduleOptions/properties/cronSpec",
          type: "string"
        },
        timezone: {
          $id: "#/properties/scheduleOptions/properties/timezone",
          type: "string"
        }
      }
    },
    firehoseOptions: {
      $id: "#/properties/firehoseOptions",
      type: "object",
      required: ["event"],
      properties: {
        event: {
          $id: "#/properties/firehoseOptions/properties/event",
          type: "string"
        }
      }
    },
    httpOptions: {
      $id: "#/properties/httpOptions",
      type: "object",
      required: ["method", "path"],
      properties: {
        method: {
          $id: "#/properties/httpOptions/properties/method",
          type: "string"
        },
        path: {
          $id: "#/properties/httpOptions/properties/path",
          type: "string"
        }
      }
    },
    systemOptions: {
      $id: "#/properties/systemOptions",
      type: "object",
      required: ["event"],
      properties: {
        event: {
          $id: "#/properties/systemOptions/properties/event",
          type: "string",
          enum: ["READY"]
        }
      }
    },
    bucketOptions: {
      $id: "#/properties/bucketOptions",
      type: "object",
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
          $id: "#/properties/bucketOptions/properties/phase",
          type: "string",
          enum: ["BEFORE", "AFTER"]
        },
        type: {
          $id: "#/properties/bucketOptions/properties/type",
          type: "string"
        },
        bucket: {
          $id: "#/properties/bucketOptions/properties/bucket",
          type: "object",
          properties: {
            resourceFieldRef: {
              $id: "#/properties/bucketOptions/properties/bucket/properties/resourceFieldRef",
              type: "object",
              properties: {
                bucketName: {
                  $id:
                    "#/properties/bucketOptions/properties/bucket/properties/resourceFieldRef/properties/bucketName",
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
