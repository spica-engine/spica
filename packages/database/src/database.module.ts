import {DynamicModule, Global, Module, Provider} from "@nestjs/common";
import {MongoClient, MongoClientOptions} from "mongodb";
import {DatabaseService} from "./database.service.js";

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
          const db = client.db(database) as DatabaseService;
          db.changeStreamAwaitTimeMS = changeStreamAwaitTimeMS;
          return db;
        },
        inject: [MongoClient]
      }
    ];
    return {
      module: DatabaseModule,
      providers: dbProvider,
      exports: dbProvider
    };
  }
}
