import {Component, Renderer2} from "@angular/core";
@Component({
  selector: "theme-switcher",
  templateUrl: "./theme-switcher.component.html"
})
export class ThemeSwitcherComponent {
  theme: boolean = false;
  constructor(private renderer: Renderer2) {}

  themeChange() {
    if (this.theme) {
      this.renderer.addClass(document.body, "dark");
    } else {
      this.renderer.removeClass(document.body, "dark");
    }
  }
}
