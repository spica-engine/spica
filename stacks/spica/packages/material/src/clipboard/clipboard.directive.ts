import {Directive, HostListener, Input} from "@angular/core";

@Directive({selector: "[matClipboard]", exportAs: "matClipboard"})
export class ClipboardDirective {
  @Input() icon: string = "info";
  @Input("matClipboard") text: string;
  constructor() {}

  @HostListener("click")
  copy() {
    let selBox = document.createElement("textarea");
    selBox.style.position = "fixed";
    selBox.style.left = "0";
    selBox.style.top = "0";
    selBox.style.opacity = "0";
    selBox.value = this.text;
    document.body.appendChild(selBox);
    selBox.focus();
    selBox.select();
    document.execCommand("copy");
    document.body.removeChild(selBox);
    this.icon = "check";
    setTimeout(() => {
      this.icon = "info";
    }, 1000);
  }
}
