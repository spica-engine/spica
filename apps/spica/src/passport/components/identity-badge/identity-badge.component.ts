import {Component} from "@angular/core";
import {Router} from "@angular/router";
import {Scheme, SchemeObserver} from "@spica-client/core/layout";
import {SchemeSwitcherComponent} from "@spica-client/core/layout/scheme-switcher/scheme-switcher.component";
import {from, Observable} from "rxjs";
import {startWith} from "rxjs/operators";
import {Identity} from "../../interfaces/identity";
import {PassportService} from "../../services/passport.service";

@Component({
  selector: "passport-identity-action",
  templateUrl: "./identity-badge.component.html",
  styleUrls: ["./identity-badge.component.scss"]
})
export class IdentityBadgeComponent {
  identity: Identity;

  dark$: Observable<boolean>;
  schemeSwitcherComponent = SchemeSwitcherComponent;

  constructor(
    private passportService: PassportService,
    private router: Router,
    private schemeObserver: SchemeObserver
  ) {
    this.identity = this.passportService.decodedToken;
    this.dark$ = this.schemeObserver
      .observe(Scheme.Dark)
      .pipe(startWith(this.schemeObserver.isMatched(Scheme.Dark)));
  }

  unidentify() {
    this.passportService.logout();
    this.router.navigate(["passport/identify"]);
  }
}
