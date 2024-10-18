import {Global, Module} from "@nestjs/common";
import {CommandMessenger} from "./messenger";
import {
  REPLICA_ID,
  replicaIdProvider,
  COMMAND_MEMORY_OPTIONS,
  replicationServiceOptions,
  REPLICATION_SERVICE_OPTIONS,
  commandMemoryOptions
} from "./interface";
import {CommandService} from "./database";
import {CommandMemory} from "./memory";
import {ClassCommander} from "./commander";
import {JobReducer} from "./reducer";
import {JobService} from "./database/job";

@Global()
@Module({})
export class ReplicationModule {
  static forRoot() {
    return {
      module: ReplicationModule,
      providers: [
        {
          provide: REPLICATION_SERVICE_OPTIONS,
          useValue: replicationServiceOptions
        },
        {
          provide: COMMAND_MEMORY_OPTIONS,
          useValue: commandMemoryOptions
        },
        {
          provide: REPLICA_ID,
          useFactory: replicaIdProvider
        },

        CommandService,
        CommandMemory,
        CommandMessenger,
        ClassCommander,

        JobService,
        JobReducer
      ],
      exports: [CommandMessenger, ClassCommander, JobReducer]
    };
  }
}
