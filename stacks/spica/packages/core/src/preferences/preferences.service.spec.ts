import {TestBed} from "@angular/core/testing";

import {PreferencesService} from "./preferences.service";

describe("PreferencesService", () => {
  beforeEach(() => TestBed.configureTestingModule({}));

  it("should be created", () => {
    const service: PreferencesService = TestBed.get(PreferencesService);
    expect(service).toBeTruthy();
  });
});
