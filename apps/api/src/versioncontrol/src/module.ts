import {Global, Module} from "@nestjs/common";
import {VersionControlController} from "./controller";
import {VersionManager} from "./interface";
import {
  REGISTER_VC_SYNC_PROVIDER,
  REGISTER_VC_SYNCHRONIZER,
  VersionControlOptions,
  VERSIONCONTROL_WORKING_DIRECTORY,
  VC_REP_MANAGER,
  VC_REPRESENTATIVE_MANAGER,
  SynchronizerArgs,
  Resource
} from "@spica-server/interface/versioncontrol";
import {RepresentativeManager, VCRepresentativeManager} from "@spica-server/representative";
import {Git} from "./versionmanager";
import fs from "fs";
import {Synchronizer} from "./synchronizer";
import {JobReducer} from "@spica-server/replication";
import {VCSynchronizer} from "./vcsynchronizer";

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
        {
          provide: VC_REP_MANAGER,
          useFactory: dir => new RepresentativeManager(dir),
          inject: [VERSIONCONTROL_WORKING_DIRECTORY]
        },
        Synchronizer,
        versionManagerProvider,
        {
          provide: REGISTER_VC_SYNC_PROVIDER,
          useFactory: (sync: Synchronizer) => provider => sync.register(provider),
          inject: [Synchronizer, VC_REP_MANAGER]
        },
        {
          provide: VC_REPRESENTATIVE_MANAGER,
          useFactory: dir => new VCRepresentativeManager(dir),
          inject: [VERSIONCONTROL_WORKING_DIRECTORY]
        },
        {
          provide: REGISTER_VC_SYNCHRONIZER,
          useFactory: () => (args: SynchronizerArgs<Resource, Resource>) => new VCSynchronizer(args)
        }
      ],
      exports: [
        REGISTER_VC_SYNC_PROVIDER,
        VC_REP_MANAGER,
        REGISTER_VC_SYNCHRONIZER,
        VC_REPRESENTATIVE_MANAGER
      ]
    };
  }
}
