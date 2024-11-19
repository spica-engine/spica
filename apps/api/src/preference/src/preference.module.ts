import {Global, Inject, Module, Optional} from "@nestjs/common";
import {DatabaseModule} from "@spica/database";
import {IRepresentativeManager} from "@spica/interface";
import {PreferenceService} from "@spica/api/src/preference/services";
import {
  REGISTER_VC_SYNC_PROVIDER,
  RegisterSyncProvider,
  VC_REP_MANAGER
} from "@spica/api/src/versioncontrol";
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
