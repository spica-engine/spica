import {Global, Module} from "@nestjs/common";
import {PreferenceService} from "@spica-server/preference/services";
import {Observable} from "rxjs";
import {jest} from "@jest/globals";

class PartialPreferenceService {
  private defaults = new Map<string, any>();

  constructor() {
    this.defaults.set("passport", {identity: {}, user: {attributes: {}}});
  }

  default = jest.fn<typeof PreferenceService.prototype.default>((preference: any) => {
    this.defaults.set(preference.scope, preference);
  });
  get = jest.fn<typeof PreferenceService.prototype.get>(scope => {
    return Promise.resolve(this.defaults.get(scope));
  });
  update = jest.fn();
  watch = jest.fn(
    (
      scope: string,
      {propagateOnStart}: {propagateOnStart: boolean} = {propagateOnStart: false}
    ) => {
      return new Observable(observer => {
        if (propagateOnStart) {
          observer.next(this.defaults.get(scope));
        }
      });
    }
  );
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
