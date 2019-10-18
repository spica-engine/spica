import {Component} from "@angular/core";
import {Observable} from "rxjs";
import {Scheme, SchemeObserver} from "../scheme.observer";

@Component({
  selector: "scheme-switcher",
  templateUrl: "./scheme-switcher.component.html"
})
export class SchemeSwitcherComponent {
  isDark$: Observable<boolean>;

  private isDark = this.schemeObserver.isMatched(Scheme.Dark);

  constructor(private schemeObserver: SchemeObserver) {
    this.isDark$ = schemeObserver.observe(Scheme.Dark);
  }

  changeScheme() {
    this.isDark = !this.isDark;
    this.schemeObserver.setScheme(this.isDark ? Scheme.Dark : Scheme.Light);
  }
}
