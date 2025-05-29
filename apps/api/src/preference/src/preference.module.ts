import {Global, Inject, Module, Optional} from "@nestjs/common";
import {DatabaseModule} from "@spica-server/database";
import {
  IRepresentativeManager,
  RepresentativeManagerResource
} from "@spica-server/interface/representative";
import {PreferenceService} from "@spica-server/preference/services";
import {
  REGISTER_VC_SYNC_PROVIDER,
  REGISTER_VC_SYNCHRONIZER,
  RegisterSyncProvider,
  RegisterVCSynchronizer,
  VC_REP_MANAGER,
  VC_REPRESENTATIVE_MANAGER
} from "@spica-server/interface/versioncontrol";
import {PreferenceController} from "./preference.controller";
import {getSyncProvider} from "./versioncontrol/schema";
import {getSynchronizer} from "./versioncontrol/synchronizer";
import {Preference} from "@spica-server/interface/preference";

@Global()
@Module({})
export class PreferenceModule {
  constructor(
    prefService: PreferenceService,
    @Optional() @Inject(VC_REP_MANAGER) private repManager: IRepresentativeManager,
    @Optional() @Inject(REGISTER_VC_SYNC_PROVIDER) registerSync: RegisterSyncProvider,
    @Inject(VC_REPRESENTATIVE_MANAGER)
    private vcRepresentativeManager: IRepresentativeManager,
    @Optional()
    @Inject(REGISTER_VC_SYNCHRONIZER)
    registerVCSynchronizer: RegisterVCSynchronizer<Preference, RepresentativeManagerResource>
  ) {
    if (registerVCSynchronizer) {
      const synchronizer = getSynchronizer(prefService, this.vcRepresentativeManager);
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
