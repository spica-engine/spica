import {TestBed} from "@angular/core/testing";

import {PassportService} from "./passport.service";

describe("PassportService", () => {
  beforeEach(() => TestBed.configureTestingModule({}));

  it("should be created", () => {
    const service: PassportService = TestBed.get(PassportService);
    expect(service).toBeTruthy();
  });
});
