import {DynamicModule, Global, Module} from "@nestjs/common";
import {MongoClient, MongoClientOptions} from "mongodb";
import {DatabaseService} from "./database.service";

@Global()
@Module({})
export class DatabaseModule {
  static withConnection(
    uri: string,
    options: Partial<MongoClientOptions> & {database: string}
  ): DynamicModule {
    const dbProvider = [
      {
        provide: MongoClient,
        useFactory: async () => {
          const opts = {...options};
          delete opts.database;
          return MongoClient.connect(uri, {...opts});
        }
      },
      {
        provide: DatabaseService,
        useFactory: async client => await client.db(options.database),
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
