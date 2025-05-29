import {Global, Inject, Module, Optional} from "@nestjs/common";
import {DatabaseModule} from "@spica-server/database";
import {IRepresentativeManager} from "@spica-server/interface/representative";
import {PreferenceService} from "@spica-server/preference/services";
import {PreferenceController} from "./preference.controller";
import {getSyncProvider} from "./versioncontrol/schema";

@Global()
@Module({})
export class PreferenceModule {
  constructor(prefService: PreferenceService) {
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
