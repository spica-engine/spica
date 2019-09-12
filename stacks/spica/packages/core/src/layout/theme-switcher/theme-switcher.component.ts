import {BreakpointObserver} from "@angular/cdk/layout";
import {DOCUMENT} from "@angular/common";
import {Component, Inject, OnDestroy, Renderer2} from "@angular/core";
import {Subscription} from "rxjs";

@Component({
  selector: "theme-switcher",
  templateUrl: "./theme-switcher.component.html"
})
export class ThemeSwitcherComponent implements OnDestroy {
  isDark: boolean = false;

  private mediaMatchObserver: Subscription;

  constructor(
    @Inject(DOCUMENT) private document: any,
    private renderer: Renderer2,
    breakpointObserver: BreakpointObserver
  ) {
    this.mediaMatchObserver = breakpointObserver
      .observe("(prefers-color-scheme: dark)")
      .subscribe(r => this.changeScheme(r.matches));
  }

  changeScheme(isDark: boolean) {
    this.isDark = isDark;
    if (this.isDark) {
      this.renderer.addClass(this.document.body, "dark");
    } else {
      this.renderer.removeClass(this.document.body, "dark");
    }
  }

  ngOnDestroy(): void {
    this.mediaMatchObserver.unsubscribe();
  }
}
