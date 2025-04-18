import {Global, Inject, Module, Optional} from "@nestjs/common";
import {DatabaseModule} from "@spica-server/database";
import {IRepresentativeManager} from "@spica-server/interface/representative";
import {PreferenceService} from "@spica-server/preference/services";
import {
  REGISTER_VC_SYNC_PROVIDER,
  RegisterSyncProvider,
  VC_REP_MANAGER
} from "@spica-server/interface/versioncontrol";
import {PreferenceController} from "./preference.controller";
import {getSyncProvider} from "./versioncontrol/schema";

@Global()
@Module({})
export class PreferenceModule {
  constructor(
    prefService: PreferenceService,
    @Optional() @Inject(VC_REP_MANAGER) private repManager: IRepresentativeManager,
    @Optional() @Inject(REGISTER_VC_SYNC_PROVIDER) registerSync: RegisterSyncProvider
  ) {
    if (registerSync) {
      const provider = getSyncProvider(prefService, this.repManager);
      registerSync(provider);
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
