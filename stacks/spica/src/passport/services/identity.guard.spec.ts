import {TestBed} from "@angular/core/testing";
import {IdentityGuard} from "./identity.guard";

describe("IdentityGuard", () => {
  beforeEach(() => TestBed.configureTestingModule({}));

  it("should be created", () => {
    const service: IdentityGuard = TestBed.get(IdentityGuard);
    expect(service).toBeTruthy();
  });
});
