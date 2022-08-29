import {Global, Module} from "@nestjs/common";
import {CommandMessenger} from "./messenger";
import {
  commandMessengerOptions,
  COMMAND_MESSENGER_OPTIONS,
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

        ClassCommander
      ],
      exports: [CommandMessenger, ClassCommander]
    };
  }
}
