import {Injectable} from "@angular/core";
import {CanActivate, CanActivateChild, Router} from "@angular/router";
import {PassportService} from "./passport.service";

@Injectable({providedIn: "root"})
export class IdentityGuard implements CanActivate, CanActivateChild {
  constructor(
    public passport: PassportService,
    public router: Router
  ) {}

  canActivate() {
    if (!this.passport.identified) {
      return this.router.createUrlTree(["passport", "identify"]);
    }
    return true;
  }

  canActivateChild() {
    return this.canActivate();
  }
}
