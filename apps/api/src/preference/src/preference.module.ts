import {Global, Inject, Module, Optional} from "@nestjs/common";
import {DatabaseModule} from "@spica-server/database";
import {PreferenceService} from "@spica-server/preference/services";
import {
  REGISTER_VC_SYNCHRONIZER,
  RegisterVCSynchronizer
} from "@spica-server/interface/versioncontrol";
import {PreferenceController} from "./preference.controller";
import {getSynchronizer} from "./versioncontrol/synchronizer";
import {Identity} from "@spica-server/interface/passport/identity";

@Global()
@Module({})
export class PreferenceModule {
  constructor(
    prefService: PreferenceService,
    @Optional()
    @Inject(REGISTER_VC_SYNCHRONIZER)
    registerVCSynchronizer: RegisterVCSynchronizer<Identity["attributes"]>
  ) {
    if (registerVCSynchronizer) {
      const synchronizer = getSynchronizer(prefService);
      registerVCSynchronizer(synchronizer);
    }
  }

  static forRoot() {
    return {
      module: PreferenceModule,
      imports: [DatabaseModule],
      controllers: [PreferenceController],
      providers: [PreferenceService],
      exports: [PreferenceService]
    };
  }
}
