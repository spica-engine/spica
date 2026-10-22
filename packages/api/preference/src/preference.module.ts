import {Global, Module} from "@nestjs/common";
import {provideRepository} from "@spica-server/data";
import {PREFERENCE_REPOSITORY} from "@spica-server/interface-preference";
import {PreferenceService, PreferenceChangeDispatcher} from "@spica-server/preference-services";
import {PreferenceController} from "./preference.controller.js";

@Global()
@Module({})
export class PreferenceModule {
  static forRoot() {
    return {
      module: PreferenceModule,
      controllers: [PreferenceController],
      providers: [
        provideRepository(PREFERENCE_REPOSITORY),
        PreferenceService,
        PreferenceChangeDispatcher
      ],
      exports: [PreferenceService, PreferenceChangeDispatcher]
    };
  }
}
