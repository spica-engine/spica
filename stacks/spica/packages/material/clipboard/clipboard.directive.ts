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

    const clipBoard = document.createElement("input");
    clipBoard.value = this.text;
    document.body.appendChild(clipBoard);
    clipBoard.focus();
    clipBoard.select();
    document.execCommand("copy");
    document.body.removeChild(clipBoard);

    this.icon = "check";
    setTimeout(() => {
      this.icon = "info";
    }, 1000);
  }
}
