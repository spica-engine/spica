import {Global, Inject, Module, Optional} from "@nestjs/common";
import {DatabaseModule} from "@spica-server/database";
import {PreferenceService} from "@spica-server/preference/services";
import {REGISTER_SYNC_PROVIDER, RegisterSyncProvider} from "@spica-server/versioncontrol";
import {PreferenceController} from "./preference.controller";
import {getSyncProvider} from "./versioncontrol/schema";
import {RepresentativeManager} from "@spica-server/core/representative";

@Global()
@Module({})
export class PreferenceModule {
  constructor(
    prefService: PreferenceService,
    @Optional() private repManager: RepresentativeManager,
    @Optional() @Inject(REGISTER_SYNC_PROVIDER) registerSync: RegisterSyncProvider
  ) {
    if (registerSync) {
      const provider = getSyncProvider(prefService, repManager);
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
