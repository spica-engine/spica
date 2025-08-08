import {Global, Module, OnModuleDestroy} from "@nestjs/common";
import {
  replicationServiceOptions,
  replicaIdProvider,
  CommandMessenger,
  ClassCommander,
  CommandMemory,
  JobReducer
} from "..";
import {REPLICA_ID, REPLICATION_SERVICE_OPTIONS} from "../../../../../libs/interface/replication";
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
