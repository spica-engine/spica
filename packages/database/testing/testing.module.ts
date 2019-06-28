import { DynamicModule, Module, OnModuleDestroy, Global } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { DatabaseService, MongoClient } from '@spica-server/database';
import { MongoMemoryServer } from 'mongodb-memory-server';
import * as os from 'os';

@Global()
@Module({})
export class DatabaseTestingModule implements OnModuleDestroy {

    constructor(private moduleRef: ModuleRef) { }

    static create(): DynamicModule {
        return {
            module: DatabaseTestingModule,
            providers: [
                {
                    provide: MongoMemoryServer,
                    useFactory: () => {
                        return new MongoMemoryServer({
                            binary: {
                                downloadDir: os.tmpdir()
                            }
                        })
                    }
                },
                {
                    provide: MongoClient,
                    useFactory: async (server: MongoMemoryServer) => {
                        const connectionString = await server.getConnectionString();
                        return MongoClient.connect(connectionString, { useNewUrlParser: true })
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