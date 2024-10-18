import {TestBed} from "@angular/core/testing";
import {UrlTree} from "@angular/router";
import {RouterTestingModule} from "@angular/router/testing";
import {IdentityGuard} from "./identity.guard";
import {PassportService} from "./passport.service";

describe("IdentityGuard", () => {
  let passportService: Partial<PassportService> = {};
  let guard: IdentityGuard;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [RouterTestingModule]
    });

    TestBed.overrideProvider(PassportService, {useValue: passportService});
    guard = TestBed.get(IdentityGuard);
  });

  it("should not redirect", () => {
    // @ts-ignore
    passportService.identified = true;
    expect(guard.canActivate()).toBe(true);
  });

  it("should redirect", () => {
    // @ts-ignore
    passportService.identified = false;
    expect(guard.canActivate() instanceof UrlTree).toBe(true);
  });
});
