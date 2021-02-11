import {Injectable} from "@nestjs/common";
import {Validator} from "@spica-server/core/schema";
import {DatabaseService, MongoClient} from "@spica-server/database";
import {JSONSchema7} from "json-schema";
import {Observable} from "rxjs";

export function getSchema(collections: string[]): JSONSchema7 {
  return {
    $id: "http://spica.internal/webhook",
    type: "object",
    required: ["url", "body", "trigger"],
    properties: {
      url: {
        type: "string",
        title: "Url",
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
        properties: {
          name: {
            type: "string",
            enum: ["database"]
          },
          active: {
            type: "boolean",
            title: "Active",
            default: true
          },
          options: {
            type: "object",
            required: ["collection", "type"],
            properties: {
              collection: {
                type: "string",
                title: "Collection",
                enum: collections
              },
              type: {
                type: "string",
                title: "Event type",
                enum: ["INSERT", "UPDATE", "REPLACE", "DELETE"]
              }
            }
          }
        }
      }
    }
  };
}

@Injectable()
export class SchemaResolver {
  constructor(private mongo: MongoClient, private db: DatabaseService, validator: Validator) {
    validator.registerUriResolver(this.resolve.bind(this));
  }

  resolve(uri: string): Observable<JSONSchema7> {
    if (uri == "http://spica.internal/webhook") {
      return new Observable(observer => {
        const collectionNames = new Set<string>();

        const notifyChanges = () => {
          const schema = getSchema(Array.from(collectionNames));
          observer.next(schema);
        };

        const stream = this.mongo.watch([
          {
            $match: {
              $or: [{operationType: "insert"}, {operationType: "drop"}],
              "ns.db": this.db.databaseName
            }
          }
        ]);

        stream.on("change", change => {
          switch (change.operationType) {
            case "drop":
              collectionNames.delete(change.ns.coll);
              notifyChanges();
              break;
            case "insert":
              if (!collectionNames.has(change.ns.coll)) {
                collectionNames.add(change.ns.coll);
                notifyChanges();
              }
              break;
          }
        });

        stream.on("close", () => observer.complete());

        this.db.collections().then(collections => {
          for (const collection of collections) {
            collectionNames.add(collection.collectionName);
          }
          notifyChanges();
        });

        return () => {
          stream.close();
        };
      });
    }
  }
}
