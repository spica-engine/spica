import {DynamicModule, Global, Module, Provider} from "@nestjs/common";
import {MongoClient, MongoClientOptions} from "mongodb";
import {DatabaseService} from "./database.service.js";
import {withChangeStreamDefaults} from "./change-stream.js";

export const DATABASE_CHANGE_STREAM_AWAIT_TIME = "DATABASE_CHANGE_STREAM_AWAIT_TIME";

@Global()
@Module({})
export class DatabaseModule {
  static withConnection(
    uri: string,
    options: Partial<MongoClientOptions> & {database: string; changeStreamAwaitTimeMS?: number}
  ): DynamicModule {
    const {database, changeStreamAwaitTimeMS, ...mongoOptions} = options;
    const dbProvider: Provider[] = [
      {
        provide: MongoClient,
        useFactory: async () => MongoClient.connect(uri, mongoOptions)
      },
      {
        provide: DatabaseService,
        useFactory: async (client: MongoClient) => {
          const db = client.db(database);
          return typeof changeStreamAwaitTimeMS === "number"
            ? withChangeStreamDefaults(db, {maxAwaitTimeMS: changeStreamAwaitTimeMS})
            : db;
        },
        inject: [MongoClient]
      },
      {
        provide: DATABASE_CHANGE_STREAM_AWAIT_TIME,
        useValue: changeStreamAwaitTimeMS
      }
    ];
    return {
      module: DatabaseModule,
      providers: dbProvider,
      exports: dbProvider
    };
  }
}
