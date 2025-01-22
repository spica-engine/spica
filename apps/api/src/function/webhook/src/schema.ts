import {Injectable} from "@nestjs/common";
import {Validator} from "@spica-server/core/schema";
import {DatabaseService} from "@spica-server/database";
import {JSONSchema7} from "json-schema";

export function getSchema(collections: string[]): JSONSchema7 {
  return {
    $id: "http://spica.internal/webhook",
    type: "object",
    required: ["title", "url", "body", "trigger"],
    properties: {
      title: {
        type: "string",
        title: "Title",
        description: "Title of the webhook"
      },
      url: {
        type: "string",
        title: "Url",
        description: "URL that the post request will be sent to",
        pattern:
          "^(http:\\/\\/www\\.|https:\\/\\/www\\.|http:\\/\\/|https:\\/\\/)?[a-z0-9]+([\\-\\.]{1}[a-z0-9]+)*\\.[a-z]{2,5}(:[0-9]{1,5})?(\\/.*)?|^((http:\\/\\/www\\.|https:\\/\\/www\\.|http:\\/\\/|https:\\/\\/)?([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])\\.){3}([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])$"
      },
      body: {
        type: "string",
        title: "Template of the body"
      },
      trigger: {
        type: "object",
        required: ["name", "options"],
        description: "The condition that must be met for sending a request to URL",
        properties: {
          name: {
            type: "string",
            enum: ["database"],
            description: "Name of the trigger type"
          },
          active: {
            type: "boolean",
            title: "Active",
            default: true,
            description: "Whether this trigger is active"
          },
          options: {
            type: "object",
            required: ["collection", "type"],
            properties: {
              collection: {
                type: "string",
                title: "Collection",
                enum: collections,
                description: "Target collection that event must be perfomed on"
              },
              type: {
                type: "string",
                title: "Event type",
                enum: ["INSERT", "UPDATE", "REPLACE", "DELETE"],
                description: "Event type that must be performed in the specified collection"
              }
            }
          }
        }
      }
    },
    additionalProperties: false
  };
}

@Injectable()
export class SchemaResolver {
  constructor(
    private db: DatabaseService,
    private validator: Validator
  ) {
    validator.registerUriResolver(this.resolve.bind(this));
  }

  resolve(uri: string): Promise<JSONSchema7> {
    if (uri == "http://spica.internal/webhook") {
      const collectionNames = new Set<string>();

      return this.db
        .collections()
        .then(collections => {
          for (const collection of collections) {
            collectionNames.add(collection.collectionName);
          }

          return getSchema(Array.from(collectionNames));
        })
        .then(schema => {
          // remove schema right after it's used.
          setImmediate(() => this.validator.removeSchema(schema.$id));
          return schema;
        });
    }
  }
}
