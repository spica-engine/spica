import {Global, Module, OnModuleDestroy} from "@nestjs/common";
import {
  REPLICATION_SERVICE_OPTIONS,
  replicationServiceOptions,
  REPLICA_ID,
  replicaIdProvider,
  CommandMessenger,
  ClassCommander,
  CommandMemory,
  JobService,
  JobReducer
} from "@spica-server/replication";
import {MockJobReducer, MockMemoryService} from "./utilities";

const memoryService = new MockMemoryService();
const jobReducer = new MockJobReducer();

@Global()
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
        ClassCommander,

        {
          provide: JobReducer,
          useFactory: () => jobReducer
        }
      ],
      exports: [CommandMessenger, ClassCommander, JobReducer]
    };
  }

  onModuleDestroy() {
    memoryService.clear();
    jobReducer.clear();
  }
}
