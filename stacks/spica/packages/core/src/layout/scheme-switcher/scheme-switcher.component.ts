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
        const root = this.document.querySelector(":root");
        if (isDark) {
          this.renderer.addClass(root, "dark");
        } else {
          this.renderer.removeClass(root, "dark");
        }
      })
    );
  }

  changeScheme() {
    this.isDark = !this.isDark;
    this.schemeObserver.setScheme(this.isDark ? Scheme.Dark : Scheme.Light);
  }
}
