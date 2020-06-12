import {Global, Module} from "@nestjs/common";
import {PreferenceService} from "@spica-server/preference/services";
import {empty} from "rxjs";

class PartialPreferenceService {
  private defaults = new Map<string, any>();
  default = jasmine
    .createSpy<typeof PreferenceService.prototype.default>("PreferenceService.default")
    .and.callFake((preference: any) => {
      this.defaults.set(preference.scope, preference);
    });
  get = jasmine
    .createSpy<typeof PreferenceService.prototype.get>("PreferenceService.get")
    .and.callFake(scope => {
      return Promise.resolve(this.defaults.get(scope));
    });
  update = jasmine.createSpy("PreferenceService.update");
  watch = jasmine.createSpy("PreferenceService.watch").and.returnValue(empty());
}

@Global()
@Module({
  providers: [
    {
      provide: PreferenceService,
      useValue: new PartialPreferenceService()
    }
  ],
  exports: [PreferenceService]
})
export class PreferenceTestingModule {}
