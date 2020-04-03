import {DynamicModule, Global, Module, OnModuleDestroy, Optional} from "@nestjs/common";
import {DatabaseService, MongoClient} from "@spica-server/database";
import {MongoMemoryReplSet, MongoMemoryServer} from "mongodb-memory-server-core";
import * as which from "which";

const MONGOD_PATH: string = which.sync("mongod");

@Global()
@Module({})
export class DatabaseTestingModule implements OnModuleDestroy {
  constructor(
    @Optional() private replicaSet: MongoMemoryReplSet,
    @Optional() private server: MongoMemoryServer
  ) {}

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
                systemBinary: MONGOD_PATH
              }
            })
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
          provide: MongoMemoryReplSet,
          useFactory: async () => {
            const replSet = new MongoMemoryReplSet({
              binary: {
                // @ts-ignore
                systemBinary: MONGOD_PATH
              },
              replSet: {count: 1},
              instanceOpts: [{storageEngine: "wiredTiger"}]
            });

            return replSet;
          }
        },
        {
          provide: MongoClient,
          useFactory: async (server: MongoMemoryReplSet) => {
            await server.waitUntilRunning();
            const connection = await MongoClient.connect(await server.getConnectionString(), {
              replicaSet: server.opts.replSet.name,
              poolSize: Number.MAX_SAFE_INTEGER,
              useNewUrlParser: true
            });

            const retry = <T>(fn: () => Promise<T>, ms) =>
              new Promise<T>(resolve => {
                fn()
                  .then(resolve)
                  .catch(() => {
                    setTimeout(() => retry(fn, ms).then(resolve), ms);
                  });
              });

            await retry(
              () =>
                connection
                  .db()
                  .admin()
                  .replSetGetStatus()
                  .then(status => {
                    const hasPrimary = (status.members as Array<any>).some(
                      member => member.state == "1" /* PRIMARY */
                    );
                    return hasPrimary ? Promise.resolve() : Promise.reject();
                  }),
              1000
            );
            return connection;
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

  async onModuleDestroy() {
    if (this.server) {
      await this.server.stop().catch(console.log);
    }

    if (this.replicaSet) {
      setTimeout(() => this.replicaSet.stop().catch(console.log), 1000);
    }
  }
}
