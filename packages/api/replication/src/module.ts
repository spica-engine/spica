import {Global, Module} from "@nestjs/common";
import {CommandMessenger} from "./messenger/index.js";
import {replicaIdProvider, replicationServiceOptions, commandMemoryOptions} from "./consts.js";
import {
  REPLICA_ID,
  COMMAND_MEMORY_OPTIONS,
  REPLICATION_SERVICE_OPTIONS
} from "@spica-server/interface-replication";
import {CommandService} from "./database/index.js";
import {CommandMemory} from "./memory/index.js";
import {ClassCommander} from "./commander.js";
import {JobReducer} from "./reducer.js";
import {JobService} from "./database/job.js";

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
