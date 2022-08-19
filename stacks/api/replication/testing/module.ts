import {Module, OnModuleDestroy} from "@nestjs/common";
import {
  REPLICATION_SERVICE_OPTIONS,
  replicationServiceOptions,
  REPLICA_ID,
  replicaIdProvider,
  CommandMessenger,
  ClassCommander,
  CommandMemory
} from "@spica-server/replication";
import {MockMemoryService} from "./utilities";

const memoryService = new MockMemoryService();

@Module({})
export class ReplicationTestingModule implements OnModuleDestroy {
  static create() {
    return {
      module: ReplicationTestingModule,
      providers: [
        {
          provide: REPLICATION_SERVICE_OPTIONS,
          useValue: replicationServiceOptions
        },
        {
          provide: CommandMemory,
          useFactory: () => memoryService
        },
        {
          provide: REPLICA_ID,
          useFactory: replicaIdProvider
        },
        CommandMessenger,
        ClassCommander
      ],
      exports: [CommandMessenger, ClassCommander]
    };
  }

  onModuleDestroy() {
    memoryService.clear();
  }
}
