import {DynamicModule, Global, Module} from "@nestjs/common";
import {DataModule} from "@spica-server/data";
import {DatabaseService, MongoClient} from "@spica-server/database";
import {start, connect, getDatabaseName} from "./start";
import {createPostgresDatabase} from "./start-postgres";
import {testingDataAdapter, testingPostgresAdapter} from "./data-adapter";

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
      imports: [DataModule.forRoot(testingDataAdapter())],
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
      imports: [DataModule.forRoot(testingDataAdapter())],
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

  static postgres(dbName?: string): DynamicModule {
    return {
      module: DatabaseTestingModule,
      imports: [DataModule.forRoot(testingPostgresAdapter(() => createPostgresDatabase(dbName)))]
    };
  }

  static connect(connectionUri: string, dbName?: string) {
    return {
      module: DatabaseTestingModule,
      imports: [DataModule.forRoot(testingDataAdapter())],
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
