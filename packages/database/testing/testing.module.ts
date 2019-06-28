import {DynamicModule, Module, OnModuleDestroy, Global} from "@nestjs/common";
import {ModuleRef} from "@nestjs/core";
import {DatabaseService, MongoClient} from "@spica-server/database";
import {MongoMemoryServer} from "mongodb-memory-server-core";
import * as path from "path";
import * as fs from "fs";

let installing: Promise<any> = Promise.resolve();

@Global()
@Module({})
export class DatabaseTestingModule implements OnModuleDestroy {
  constructor(private moduleRef: ModuleRef) {}

  static create(): DynamicModule {
    const downloadDir = path.join(
      path.dirname(fs.realpathSync(require.resolve("mongodb-memory-server-core"))),
      ".cache"
    );
    return {
      module: DatabaseTestingModule,
      providers: [
        {
          provide: MongoMemoryServer,
          useFactory: async () => {
            // To prevent redundant installations
            await installing;
            return new MongoMemoryServer({
              binary: {
                downloadDir
              }
            });
          }
        },
        {
          provide: MongoClient,
          useFactory: async (server: MongoMemoryServer) => {
            if (!fs.existsSync(downloadDir)) {
              installing = server.ensureInstance();
            }
            const connectionString = await server.getConnectionString();
            return MongoClient.connect(connectionString, {useNewUrlParser: true});
          },
          inject: [MongoMemoryServer]
        },
        {
          provide: DatabaseService,
          useFactory: async (client: MongoClient, server: MongoMemoryServer) => {
            const dbName = await server.getDbName();
            return client.db(dbName);
          },
          inject: [MongoClient, MongoMemoryServer]
        }
      ],
      exports: [DatabaseService]
    };
  }

  onModuleDestroy() {
    this.moduleRef.get(MongoMemoryServer).stop();
  }
}
