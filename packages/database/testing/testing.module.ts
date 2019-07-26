import {DynamicModule, Global, Module, OnModuleDestroy} from "@nestjs/common";
import {ModuleRef} from "@nestjs/core";
import {DatabaseService, MongoClient} from "@spica-server/database";
import * as fs from "fs";
import {MongoMemoryReplSet, MongoMemoryServer} from "mongodb-memory-server-core";
import * as path from "path";

let installing: Promise<any> = Promise.resolve();

const downloadDir = path.join(
  path.dirname(fs.realpathSync(require.resolve("mongodb-memory-server-core"))),
  ".cache"
);

@Global()
@Module({})
export class DatabaseTestingModule implements OnModuleDestroy {
  constructor(private moduleRef: ModuleRef) {}

  static create(): DynamicModule {
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

  static replicaSet(): DynamicModule {
    return {
      module: DatabaseTestingModule,
      providers: [
        {
          provide: MongoMemoryReplSet,
          useFactory: async () =>
            new MongoMemoryReplSet({
              binary: {
                downloadDir,
                version: "4.0.3"
              },
              instanceOpts: [
                {storageEngine: "wiredTiger"},
                {storageEngine: "wiredTiger"},
                {storageEngine: "wiredTiger"}
              ]
            })
        },
        {
          provide: MongoClient,
          useFactory: async (server: MongoMemoryReplSet) => {
            await server.waitUntilRunning();
            const connectionString = await server.getConnectionString();
            // Issue: https://github.com/nodkz/mongodb-memory-server/issues/166
            await new Promise(resolve => setTimeout(resolve, 2000));
            return MongoClient.connect(
              `${connectionString}?replicaSet=${server.opts.replSet.name}`,
              {
                useNewUrlParser: true,
                replicaSet: server.opts.replSet.name
              }
            );
          },
          inject: [MongoMemoryReplSet]
        },
        {
          provide: DatabaseService,
          useFactory: async (client: MongoClient, server: MongoMemoryReplSet) =>
            client.db(await server.getDbName()),
          inject: [MongoClient, MongoMemoryReplSet]
        }
      ],
      exports: [DatabaseService]
    };
  }

  onModuleDestroy() {
    try {
      this.moduleRef.get(MongoMemoryServer).stop();
    } catch {}
    try {
      this.moduleRef.get(MongoMemoryReplSet).stop();
    } catch {}
  }
}
