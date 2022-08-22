import {Global, Module} from "@nestjs/common";
import {CommandMessenger} from "./messenger";
import {
  commandMessengerOptions,
  COMMAND_MESSENGER_OPTIONS,
  REPLICA_ID,
  replicaIdProvider,
  COMMAND_MEMORY_OPTIONS,
  REPLICATION_SERVICE_OPTIONS,
  commandMemoryOptions,
  ReplicationServiceOptions
} from "./interface";
import {CommandService} from "./database";
import {CommandMemory} from "./memory";
import {ClassCommander} from "./commander";

@Global()
@Module({})
export class ReplicationModule {
  static forRoot(replicationServiceOptions: ReplicationServiceOptions) {
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

        ClassCommander
      ],
      exports: [CommandMessenger, ClassCommander]
    };
  }
}
