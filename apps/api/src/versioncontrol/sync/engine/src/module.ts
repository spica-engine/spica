import {Module} from "@nestjs/common";
import {SyncEngine} from "./engine";
import {
  ChangeLogProcessor,
  ChangeLogProcessorsModule
} from "@spica-server/versioncontrol/processors/changelog";
import {SyncProcessor, SyncProcessorsModule} from "@spica-server/versioncontrol/processors/sync";
import {VC_REPRESENTATIVE_MANAGER} from "@spica-server/interface/versioncontrol";
import {JobReducer} from "@spica-server/replication";

@Module({})
export class SyncEngineModule {
  static forRoot(options: {isReplicationEnabled: boolean}) {
    const syncEngineProvider = {
      provide: SyncEngine,
      useFactory: (changeLogProcessor, syncProcessor, repManager, jobReducer) =>
        new SyncEngine(changeLogProcessor, syncProcessor, repManager, jobReducer),
      inject: [ChangeLogProcessor, SyncProcessor, VC_REPRESENTATIVE_MANAGER]
    };

    if (options.isReplicationEnabled) {
      syncEngineProvider.inject.push(JobReducer as any);
    }

    return {
      module: SyncEngineModule,
      imports: [ChangeLogProcessorsModule.forRoot(), SyncProcessorsModule.forRoot()],
      providers: [syncEngineProvider],
      exports: [SyncEngine]
    };
  }
}
