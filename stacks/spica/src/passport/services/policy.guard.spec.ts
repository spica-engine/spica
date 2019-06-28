import {TestBed} from "@angular/core/testing";
import {PolicyGuard} from "./policy.guard";

describe("PolicyGuard", () => {
  beforeEach(() => TestBed.configureTestingModule({}));

  it("should be created", () => {
    const service: PolicyGuard = TestBed.get(PolicyGuard);
    expect(service).toBeTruthy();
  });
});
