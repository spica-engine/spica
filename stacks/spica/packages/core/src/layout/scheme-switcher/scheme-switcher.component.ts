import {DOCUMENT} from "@angular/common";
import {Component, Inject, Renderer2} from "@angular/core";
import {Observable} from "rxjs";
import {tap} from "rxjs/operators";
import {Scheme, SchemeObserver} from "../scheme.observer";

@Component({
  selector: "scheme-switcher",
  templateUrl: "./scheme-switcher.component.html"
})
export class SchemeSwitcherComponent {
  isDark$: Observable<boolean>;

  private isDark = false;

  constructor(
    @Inject(DOCUMENT) private document: any,
    private renderer: Renderer2,
    private schemeObserver: SchemeObserver
  ) {
    this.isDark$ = schemeObserver.observe(Scheme.Dark).pipe(
      tap(isDark => {
        this.isDark = isDark;
        if (isDark) {
          this.renderer.addClass(this.document.body, "dark");
        } else {
          this.renderer.removeClass(this.document.body, "dark");
        }
      })
    );
  }

  changeScheme() {
    this.isDark = !this.isDark;
    this.schemeObserver.setScheme(this.isDark ? Scheme.Dark : Scheme.Light);
  }
}
