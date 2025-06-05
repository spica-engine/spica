import {Global, Module} from "@nestjs/common";
import {VersionControlController} from "./controller";
import {VersionManager} from "./interface";
import {
  REGISTER_VC_SYNCHRONIZER,
  VersionControlOptions,
  VERSIONCONTROL_WORKING_DIRECTORY,
  VC_REPRESENTATIVE_MANAGER,
  VCSynchronizerArgs
} from "@spica-server/interface/versioncontrol";
import {VCRepresentativeManager} from "@spica-server/representative";
import {Git} from "./versionmanager";
import fs from "fs";
import {JobReducer} from "@spica-server/replication";
import {VCSynchronizer} from "./synchronizer/vcsynchronizer";

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
    return {
      module: VersionControlModule,
      controllers: [VersionControlController],
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
        {
          provide: REGISTER_VC_SYNCHRONIZER,
          useFactory:
            (vcRepresentativeManager: VCRepresentativeManager) =>
            <R1>(args: VCSynchronizerArgs<R1>) =>
              new VCSynchronizer(args, vcRepresentativeManager).start(),
          inject: [VC_REPRESENTATIVE_MANAGER]
        }
      ],
      exports: [REGISTER_VC_SYNCHRONIZER, VC_REPRESENTATIVE_MANAGER]
    };
  }
}
