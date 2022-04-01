import {Global, Module} from "@nestjs/common";
import {VersionControlController} from "./controller";
import {REGISTER_SYNC_PROVIDER, WORKING_DIR} from "./interface";
import {RepresentativeManager} from "./representative";
import {Synchronizer} from "./synchronizer";
import {Git} from "./versionmanager";

@Global()
@Module({
  controllers: [VersionControlController],
  providers: [
    {
      provide: WORKING_DIR,
      useValue: `${process.cwd}/representatives`
    },
    RepresentativeManager,
    Synchronizer,
    Git,
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
