import {Global, Inject, Module, Optional} from "@nestjs/common";
import {DatabaseModule} from "@spica-server/database";
import {IRepresentativeManager} from "@spica-server/interface/representative";
import {PreferenceService} from "@spica-server/preference/services";
import {
  REGISTER_VC_SYNCHRONIZER,
  RegisterVCSynchronizer,
  VC_REPRESENTATIVE_MANAGER
} from "@spica-server/interface/versioncontrol";
import {PreferenceController} from "./preference.controller";
import {getSynchronizer} from "./versioncontrol/synchronizer";
import {Preference} from "@spica-server/interface/preference";

@Global()
@Module({})
export class PreferenceModule {
  constructor(
    prefService: PreferenceService,
    @Optional()
    @Inject(REGISTER_VC_SYNCHRONIZER)
    registerVCSynchronizer: RegisterVCSynchronizer<Preference>
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
