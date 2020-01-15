import {DynamicModule, Global, Module, OnModuleDestroy} from "@nestjs/common";
import {ModuleRef} from "@nestjs/core";
import {DatabaseService, MongoClient} from "@spica-server/database";
import * as fs from "fs";
import {MongoMemoryReplSet, MongoMemoryServer} from "mongodb-memory-server-core";
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
          useFactory: async () =>
            new MongoMemoryServer({
              binary: {
                // @ts-ignore
                systemBinary: fs.existsSync("/usr/bin/mongod")
                  ? "/usr/bin/mongod"
                  : "/usr/local/bin/mongod"
              }
            })
        },
        {
          provide: MongoClient,
          useFactory: async (server: MongoMemoryServer) =>
            MongoClient.connect(await server.getConnectionString(), {
              // @ts-ignore
              useUnifiedTopology: true
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
          provide: MongoMemoryReplSet,
          useFactory: async () =>
            new MongoMemoryReplSet({
              binary: {
                // @ts-ignore
                systemBinary: fs.existsSync("/usr/bin/mongod")
                  ? "/usr/bin/mongod"
                  : "/usr/local/bin/mongod"
              },
              replSet: {
                count: 3
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
            await new Promise(resolve => setTimeout(resolve, 1000));
            return MongoClient.connect(
              `${connectionString}?replicaSet=${server.opts.replSet.name}`,
              {
                useNewUrlParser: true,
                replicaSet: server.opts.replSet.name,
                poolSize: 200
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
      exports: [DatabaseService, MongoClient]
    };
  }

  static async setDelayedReplica(dbService: DatabaseService) {
    //get current configure and reconfigure it
    let config = (await dbService.executeDbAdminCommand({replSetGetConfig: 1})).config;
    config.version = config.version + 1;
    config.members[2] = {
      ...config.members[2],
      hidden: true,
      priority: 0,
      slaveDelay: 5,
      tags: {slaveDelay: "true"}
    };
    await dbService.executeDbAdminCommand({replSetReconfig: config});
    //wait until replicaSet reconfigured
    await new Promise(resolve => setTimeout(resolve, 10000));
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
