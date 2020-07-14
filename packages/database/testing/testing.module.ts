import {DynamicModule, Global, Module} from "@nestjs/common";
import {DatabaseService, MongoClient} from "@spica-server/database";
import {start, getDatabaseName} from "./start";

@Global()
@Module({
  providers: [
    {
      provide: DatabaseService,
      useFactory: async (client: MongoClient) => client.db(getDatabaseName()),
      inject: [MongoClient]
    }
  ],
  exports: [DatabaseService]
})
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

  static standalone(): DynamicModule {
    return {
      module: DatabaseTestingModule,
      providers: [
        {
          provide: MongoClient,
          useFactory: async () => start("standalone")
        }
      ],
      exports: [MongoClient]
    };
  }
  static replicaSet(): DynamicModule {
    return {
      module: DatabaseTestingModule,
      providers: [
        {
          provide: MongoClient,
          useFactory: async () => start("replset")
        }
      ],
      exports: [DatabaseService, MongoClient]
    };
  }
}
