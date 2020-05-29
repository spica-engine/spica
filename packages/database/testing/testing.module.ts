import {DynamicModule, Global, Module, OnModuleDestroy, Optional} from "@nestjs/common";
import {DatabaseService, MongoClient} from "@spica-server/database";
import {MongoMemoryServer} from "mongodb-memory-server-core";
import * as which from "which";
import {getDatabaseName, start} from "./start";

const MONGOD_PATH: string = which.sync("mongod");

@Global()
@Module({})
export class DatabaseTestingModule implements OnModuleDestroy {
  constructor(@Optional() private server: MongoMemoryServer) {}

  static create(): DynamicModule {
    return {
      module: DatabaseTestingModule,
      providers: [
        {
          provide: MongoMemoryServer,
          useFactory: async () => {
            return new MongoMemoryServer({
              binary: {
                // @ts-ignore
                systemBinary: MONGOD_PATH
              }
            });
          }
        },
        {
          provide: MongoClient,
          useFactory: async (server: MongoMemoryServer) =>
            MongoClient.connect(await server.getConnectionString(), {
              useNewUrlParser: true
            }),
          inject: [MongoMemoryServer]
        },
        {
          provide: DatabaseService,
          useFactory: async (client: MongoClient, server: MongoMemoryServer) =>
            client.db(await server.getDbName()),
          inject: [MongoClient, MongoMemoryServer]
        }
      ],
      exports: [DatabaseService, MongoClient]
    };
  }
  static replicaSet(): DynamicModule {
    return {
      module: DatabaseTestingModule,
      providers: [
        {
          provide: MongoClient,
          useFactory: () => start("replset")
        },
        {
          provide: DatabaseService,
          useFactory: async (client: MongoClient) => client.db(getDatabaseName()),
          inject: [MongoClient]
        }
      ],
      exports: [DatabaseService, MongoClient]
    };
  }

  async onModuleDestroy() {
    if (this.server) {
      await this.server.stop().catch(console.log);
    }
  }
}
