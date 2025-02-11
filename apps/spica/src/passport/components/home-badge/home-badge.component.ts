import {Component} from "@angular/core";
import {Router} from "@angular/router";
import {Scheme, SchemeObserver} from "@spica-client/core/layout";
import {SchemeSwitcherComponent} from "@spica-client/core/layout/scheme-switcher/scheme-switcher.component";
import {Observable} from "rxjs";
import {startWith} from "rxjs/operators";

@Component({
  selector: "home-badge-action",
  templateUrl: "./home-badge.component.html",
  styleUrls: ["./home-badge.component.scss"]
})
export class HomeBadgeComponent {
  dark$: Observable<boolean>;
  schemeSwitcherComponent = SchemeSwitcherComponent;

  constructor(
    private router: Router,
    private schemeObserver: SchemeObserver
  ) {
    this.dark$ = this.schemeObserver
      .observe(Scheme.Dark)
      .pipe(startWith(this.schemeObserver.isMatched(Scheme.Dark)));
  }
}
