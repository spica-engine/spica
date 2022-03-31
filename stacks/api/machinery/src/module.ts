import {Global, Module} from "@nestjs/common";
import {ApiMachineryController, ApiMachineryObjectController} from "./controller";
import {RepresentativeManager} from "./representative";
import {Synchronizer} from "./synchronizer";

export const REGISTER_SYNC_PROVIDER = Symbol.for("REGISTER_SYNC_PROVIDER");

@Global()
@Module({
  controllers: [ApiMachineryObjectController, ApiMachineryController],
  providers: [
    RepresentativeManager,
    Synchronizer,
    {
      provide: REGISTER_SYNC_PROVIDER,
      useFactory: (sync: Synchronizer, manager: RepresentativeManager) => {
        return {
          manager: manager,
          register: (rep, doc) => sync.register(rep, doc)
        };
      },
      inject: [Synchronizer, RepresentativeManager]
    }
  ],
  exports: [REGISTER_SYNC_PROVIDER]
})
export class ApiMachineryModule {}
