import {Global, Module} from "@nestjs/common";
import {CommandMessenger} from "./messenger/index.js";
import {replicaIdProvider, replicationServiceOptions, commandMemoryOptions} from "./consts.js";
import {
  REPLICA_ID,
  COMMAND_MEMORY_OPTIONS,
  REPLICATION_SERVICE_OPTIONS,
  JOB_REPOSITORY,
  COMMAND_REPOSITORY
} from "@spica-server/interface-replication";
import {CommandMemory} from "./memory/index.js";
import {ClassCommander} from "./commander.js";
import {JobReducer} from "./reducer.js";
import {provideRepository} from "@spica-server/data";

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

        provideRepository(COMMAND_REPOSITORY),
        CommandMemory,
        CommandMessenger,
        ClassCommander,

        provideRepository(JOB_REPOSITORY),
        JobReducer
      ],
      exports: [CommandMessenger, ClassCommander, JobReducer]
    };
  }
}
