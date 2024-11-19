import {Global, Module} from "@nestjs/common";
import {VersionControlController} from "./controller";
import {
  REGISTER_VC_SYNC_PROVIDER,
  VersionManager,
  VersionControlOptions,
  VERSIONCONTROL_WORKING_DIRECTORY,
  VC_REP_MANAGER
} from "./interface";
import {RepresentativeManager} from "@spica/representative";
import {Git} from "./versionmanager";
import * as fs from "fs";
import {Synchronizer} from "./synchronizer";

@Global()
@Module({})
export class VersionControlModule {
  static forRoot(options: VersionControlOptions) {
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
        {
          provide: VersionManager,
          useFactory: cwd => new Git(cwd),
          inject: [VERSIONCONTROL_WORKING_DIRECTORY]
        },
        {
          provide: REGISTER_VC_SYNC_PROVIDER,
          useFactory: (sync: Synchronizer) => provider => sync.register(provider),
          inject: [Synchronizer, VC_REP_MANAGER]
        }
      ],
      exports: [REGISTER_VC_SYNC_PROVIDER, VC_REP_MANAGER]
    };
  }
}
