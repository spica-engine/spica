import {DynamicModule, Global, Module} from "@nestjs/common";
import {DatabaseService, MongoClient} from "../..";
import {start, connect, getDatabaseName} from "./start";

@Global()
@Module({})
export class DatabaseTestingModule {
  /**
   * @deprecated
   */
  static create(): DynamicModule {
    console.warn(
      "DatabaseTestingModule.create is deprecated. Use DatabaseTestingModule.standalone instead."
    );
    return DatabaseTestingModule.standalone();
  }
  static standalone(dbName?: string): DynamicModule {
    return {
      module: DatabaseTestingModule,
      providers: [
        {
          provide: MongoClient,
          useFactory: async () => start("standalone")
        },
        {
          provide: DatabaseService,
          useFactory: async (client: MongoClient) => client.db(dbName || getDatabaseName()),
          inject: [MongoClient]
        }
      ],
      exports: [MongoClient, DatabaseService]
    };
  }
  static replicaSet(dbName?: string): DynamicModule {
    return {
      module: DatabaseTestingModule,
      providers: [
        {
          provide: MongoClient,
          useFactory: async () => start("replset")
        },
        {
          provide: DatabaseService,
          useFactory: async (client: MongoClient) => client.db(dbName || getDatabaseName()),
          inject: [MongoClient]
        }
      ],
      exports: [MongoClient, DatabaseService]
    };
  }

  static connect(connectionUri: string, dbName?: string) {
    return {
      module: DatabaseTestingModule,
      providers: [
        {
          provide: MongoClient,
          useFactory: async () => connect(connectionUri)
        },
        {
          provide: DatabaseService,
          useFactory: async (client: MongoClient) => client.db(dbName || getDatabaseName()),
          inject: [MongoClient]
        }
      ],
      exports: [MongoClient, DatabaseService]
    };
  }
}
