import {Global, Module} from "@nestjs/common";
import {VersionControlController} from "./controller";
import {REGISTER_SYNC_PROVIDER, WORKING_DIR, VersionManager} from "./interface";
import {RepresentativeManager} from "./representative";
import {Synchronizer} from "./synchronizer";
import {Git} from "./versionmanager";

import * as fs from "fs";

@Global()
@Module({
  controllers: [VersionControlController],
  providers: [
    {
      provide: WORKING_DIR,
      useFactory: () => {
        // const dir = `${process.cwd()}/representatives`;
        const dir = `/Users/tuna/Desktop/representatives`;
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir);
        }
        return dir;
      }
    },
    RepresentativeManager,
    Synchronizer,
    {provide: VersionManager, useFactory: cwd => new Git(cwd), inject: [WORKING_DIR]},
    {
      provide: REGISTER_SYNC_PROVIDER,
      useFactory: (sync: Synchronizer, manager: RepresentativeManager) => {
        return {
          manager: manager,
          register: provider => sync.register(provider)
        };
      },
      inject: [Synchronizer, RepresentativeManager]
    }
  ],
  exports: [REGISTER_SYNC_PROVIDER]
})
export class VersionControlModule {}
