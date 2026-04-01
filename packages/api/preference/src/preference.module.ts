import {Global, Module} from "@nestjs/common";
import {DatabaseModule} from "@spica-server/database";
import {PreferenceService} from "@spica-server/preference/services";
import {PreferenceController} from "./preference.controller.js";

@Global()
@Module({})
export class PreferenceModule {
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
