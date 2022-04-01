import {Global, Module} from "@nestjs/common";
import {REGISTER_SYNC_PROVIDER} from "./interface";
import {RepresentativeManager} from "./representative";
import {Synchronizer} from "./synchronizer";

@Global()
@Module({
  providers: [
    RepresentativeManager,
    Synchronizer,
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
