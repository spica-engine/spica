import {Component} from "@angular/core";
import {Observable} from "rxjs";
import {map, startWith, tap} from "rxjs/operators";
import {Scheme, SchemeObserver} from "../scheme.observer";

@Component({
  selector: "scheme-switcher",
  styleUrls: ["./scheme-switcher.component.scss"],
  templateUrl: "./scheme-switcher.component.html"
})
export class SchemeSwitcherComponent {
  Scheme = Scheme;
  scheme$: Observable<Scheme>;

  constructor(private schemeObserver: SchemeObserver) {
    this.scheme$ = schemeObserver.observe(Scheme.Dark).pipe(
      startWith(this.schemeObserver.isMatched(Scheme.Dark)),
      map(isDark => (isDark ? Scheme.Dark : Scheme.Light))
    );
  }

  changeScheme() {
    this.schemeObserver.setScheme(
      this.schemeObserver.isMatched(Scheme.Dark) ? Scheme.Light : Scheme.Dark
    );
  }
}
