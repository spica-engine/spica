import {Directive, HostListener, Input} from "@angular/core";

@Directive({
  selector: "[matClipboard]",
  exportAs: "matClipboard"
})
export class MatClipboardDirective {
  @Input() icon: string = "info";
  @Input("matClipboard") text: string;

  @HostListener("click")
  copy() {
    if (!this.text) {
      return;
    }
    const clipboard = document.createElement("input");
    clipboard.innerText = this.text;
    clipboard.select();
    clipboard.setSelectionRange(0, this.text.length);
    document.execCommand("copy");
    this.icon = "check";
    setTimeout(() => {
      this.icon = "info";
    }, 1000);
  }
}
