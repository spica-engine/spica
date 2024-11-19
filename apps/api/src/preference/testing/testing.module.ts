import {Global, Module} from "@nestjs/common";
import {PreferenceService} from "@spica/api/src/preference/services";
import {Observable} from "rxjs";

class PartialPreferenceService {
  private defaults = new Map<string, any>();

  constructor() {
    this.defaults.set("passport", {identity: {attributes: {}}});
  }

  // TODO: uncomment and fix when switching to jest

  // default = jasmine
  //   .createSpy<typeof PreferenceService.prototype.default>("PreferenceService.default")
  //   .and.callFake((preference: any) => {
  //     this.defaults.set(preference.scope, preference);
  //   });
  // get = jasmine
  //   .createSpy<typeof PreferenceService.prototype.get>("PreferenceService.get")
  //   .and.callFake(scope => {
  //     return Promise.resolve(this.defaults.get(scope));
  //   });
  // update = jasmine.createSpy("PreferenceService.update");
  // watch = jasmine
  //   .createSpy("PreferenceService.watch")
  //   .and.callFake(
  //     (
  //       scope: string,
  //       {propagateOnStart}: {propagateOnStart: boolean} = {propagateOnStart: false}
  //     ) => {
  //       return new Observable(observer => {
  //         if (propagateOnStart) {
  //           observer.next(this.defaults.get(scope));
  //         }
  //       });
  //     }
  //   );
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
