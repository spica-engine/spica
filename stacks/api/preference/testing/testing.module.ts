import {Global, Module} from "@nestjs/common";
import {PreferenceService} from "@spica-server/preference/services";
import {empty} from "rxjs";

@Global()
@Module({
  providers: [
    {
      provide: PreferenceService,
      useValue: {
        default: jasmine.createSpy("PreferenceService.default"),
        get: jasmine.createSpy("PreferenceService.get"),
        update: jasmine.createSpy("PreferenceService.update"),
        watch: jasmine.createSpy("PreferenceService.watch").and.returnValue(empty())
      }
    }
  ],
  exports: [PreferenceService]
})
export class PreferenceTestingModule {}
