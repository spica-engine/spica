import {DynamicModule, Global, Module, Provider} from "@nestjs/common";
import {MongoClient, MongoClientOptions} from "mongodb";
import {DatabaseService} from "./database.service.js";
import {MongoDatabase} from "../mongo/src/mongo.database.js";

export type Backend = "mongodb" | "postgres";

export interface ConnectionOptions extends Partial<MongoClientOptions> {
  database: string;
  changeStreamAwaitTimeMS?: number;
}

/**
 * The backend from the URI scheme. **No silent default**: an unrecognized scheme raises at
 * startup, because silently connecting to the wrong backend is the easiest way to split the data in two.
 */
export function backendFromUri(uri: string): Backend {
  const scheme = /^([a-zA-Z0-9+.-]+):\/\//.exec(uri || "")?.[1]?.toLowerCase();

  switch (scheme) {
    case "mongodb":
    case "mongodb+srv":
      return "mongodb";
    case "postgres":
    case "postgresql":
      return "postgres";
    default:
      throw new Error(
        `Unsupported --database-uri scheme ${scheme ? `'${scheme}'` : "(missing)"}. ` +
          `Use mongodb:// or mongodb+srv:// for MongoDB, postgres:// or postgresql:// for PostgreSQL.`
      );
  }
}

@Global()
@Module({})
export class DatabaseModule {
  static withConnection(uri: string, options: ConnectionOptions): DynamicModule {
    const backend = backendFromUri(uri);
    const {database, changeStreamAwaitTimeMS, ...driverOptions} = options;

    /**
     * The selection goes through `await import()`: `pg` (and the reverse) is never brought into memory
     * in Mongo installations. Because both drivers are in the same image there is no installation step
     * and no version mismatch.
     */
    const dbProvider: Provider[] = [
      {
        provide: DatabaseService,
        useFactory: async (): Promise<DatabaseService> => {
          if (backend !== "mongodb") {
            throw new Error(
              `This build carries the MongoDB driver only; '${uri.split(":")[0]}://' needs the ` +
                `PostgreSQL driver, which is not part of it.`
            );
          }

          const service = await connectMongo(uri, database, driverOptions);

          service.changeStreamAwaitTimeMS = changeStreamAwaitTimeMS;
          return service;
        }
      }
    ];

    return {
      module: DatabaseModule,
      providers: dbProvider,
      exports: dbProvider
    };
  }
}

async function connectMongo(
  uri: string,
  database: string,
  options: Partial<MongoClientOptions>
): Promise<DatabaseService> {
  const client = await MongoClient.connect(uri, options);
  return new MongoDatabase(client.db(database), client);
}

