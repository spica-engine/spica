import {Injectable} from "@nestjs/common";
import {Validator} from "@spica-server/core/schema";
import {DatabaseService, MongoClient} from "@spica-server/database";
import {JSONSchema7} from "json-schema";
import {Observable} from "rxjs";

export function getSchema(collections: string[]): JSONSchema7 {
  return {
    $id: "http://spica.internal/webhook",
    type: "object",
    properties: {
      url: {
        type: "string",
        title: "Url",
        format: "url"
      },
      trigger: {
        type: "object",
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
