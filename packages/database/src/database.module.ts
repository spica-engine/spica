import {DynamicModule, Global, Module, Provider} from "@nestjs/common";
import {MongoClient, MongoClientOptions} from "mongodb";
import {DatabaseService} from "./database.service.js";

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
          // MongoDB has no connection-level default for a change stream's maxAwaitTimeMS, and change
          // streams are opened all over the codebase: BaseCollection.watch(), direct _coll.watch(),
          // db.collection(name).watch(), and the realtime service. They ALL obtain their collection
          // through db.collection(name), so wrapping it here makes every change stream inherit the
          // configured maxAwaitTimeMS from a single place. Caller-supplied options still win, and
          // omitting the flag leaves behavior unchanged (backward compatible).
          if (typeof changeStreamAwaitTimeMS === "number") {
            const getCollection = db.collection.bind(db);
            (db as any).collection = (name: string, opts?: any) => {
              const collection = getCollection(name, opts) as any;
              const watch = collection.watch.bind(collection);
              collection.watch = (pipeline?: any[], watchOptions?: any) =>
                watch(pipeline, {maxAwaitTimeMS: changeStreamAwaitTimeMS, ...watchOptions});
              return collection;
            };
          }
          return db;
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
