import {Global, Module} from "@nestjs/common";
import {VersionControlController} from "./controller";
import {VersionManager} from "./interface";
import {
  VersionControlOptions,
  VERSIONCONTROL_WORKING_DIRECTORY,
  VC_REPRESENTATIVE_MANAGER,
  REGISTER_VC_CHANGE_HANDLER,
  DocumentChangeSupplier,
  DocumentChangeApplier
} from "@spica-server/interface/versioncontrol";
import {VCRepresentativeManager} from "@spica-server/representative";
import {Git} from "./versionmanager";
import fs from "fs";
import {ClassCommander, JobReducer} from "@spica-server/replication";
import {SyncModule} from "@spica-server/versioncontrol/sync";
import {SyncEngine, SyncEngineModule} from "@spica-server/versioncontrol/sync/engine";

@Global()
@Module({})
export class VersionControlModule {
  static forRoot(options: VersionControlOptions) {
    const versionManagerProvider = {
      provide: VersionManager,
      useFactory: (cwd, jr) => new Git(cwd, jr),
      inject: [VERSIONCONTROL_WORKING_DIRECTORY]
    };
    if (options.isReplicationEnabled) {
      versionManagerProvider.inject.push(JobReducer as any);
    }

    const vcChangeHandlerProvider = {
      provide: REGISTER_VC_CHANGE_HANDLER,
      useFactory: (engine: SyncEngine) => {
        return (supplier: DocumentChangeSupplier, applier: DocumentChangeApplier) => {
          engine.registerChangeHandler(supplier, applier);
        };
      }
    };

    // if (options.isReplicationEnabled) {
    //   vcsynchronizerProvider.inject.push(JobReducer as any, ClassCommander as any);
    // }

    return {
      module: VersionControlModule,
      controllers: [VersionControlController],
      imports: [SyncModule, SyncEngineModule],
      providers: [
        {
          provide: VERSIONCONTROL_WORKING_DIRECTORY,
          useFactory: () => {
            const dir = `${options.persistentPath}/representatives`;
            if (!fs.existsSync(dir)) {
              fs.mkdirSync(dir);
            }
            return dir;
          }
        },
        versionManagerProvider,
        {
          provide: VC_REPRESENTATIVE_MANAGER,
          useFactory: dir => new VCRepresentativeManager(dir),
          inject: [VERSIONCONTROL_WORKING_DIRECTORY]
        },
        vcChangeHandlerProvider
      ],
      exports: [REGISTER_VC_CHANGE_HANDLER, VC_REPRESENTATIVE_MANAGER]
    };
  }
}
