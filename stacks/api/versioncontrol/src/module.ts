import {Global, Module} from "@nestjs/common";
import {VersionControlController} from "./controller";
import {
  REGISTER_SYNC_PROVIDER,
  WORKING_DIR,
  VersionManager,
  VersionControlOptions
} from "./interface";
import {RepresentativeManager} from "@spica-server/core/representative";
import {Synchronizer} from "./synchronizer";
import {Git} from "./versionmanager";

import * as fs from "fs";

@Global()
@Module({})
export class VersionControlModule {
  static forRoot(options: VersionControlOptions) {
    return {
      module: VersionControlModule,
      controllers: [VersionControlController],
      providers: [
        {
          provide: WORKING_DIR,
          useFactory: () => {
            const dir = `${options.persistentPath}/representatives`;
            if (!fs.existsSync(dir)) {
              fs.mkdirSync(dir);
            }
            return dir;
          }
        },
        {
          provide: RepresentativeManager,
          useFactory: cwd => new RepresentativeManager(cwd),
          inject: [WORKING_DIR]
        },
        Synchronizer,
        {provide: VersionManager, useFactory: cwd => new Git(cwd), inject: [WORKING_DIR]},
        {
          provide: REGISTER_SYNC_PROVIDER,
          useFactory: (sync: Synchronizer) => provider => sync.register(provider),
          inject: [Synchronizer, RepresentativeManager]
        }
      ],
      exports: [REGISTER_SYNC_PROVIDER, RepresentativeManager]
    };
  }
}
