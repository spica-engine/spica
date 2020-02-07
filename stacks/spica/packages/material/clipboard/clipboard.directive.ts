import {Directive, HostListener, Input} from "@angular/core";

@Directive({
  selector: "[matClipboard]",
  exportAs: "matClipboard"
})
export class MatClipboardDirective {
  @Input() icon: string = "info";
  @Input("matClipboard") text: string;

  clipBoardElement: HTMLInputElement;

  @HostListener("click")
  copy() {
    if (!this.text) {
      return;
    }

    this.prepareClipBoard(this.text);

    document.execCommand("copy");

    document.body.removeChild(this.clipBoardElement);

    this.icon = "check";
    setTimeout(() => {
      this.icon = "info";
    }, 1000);
  }

  prepareClipBoard(text: string) {
    this.clipBoardElement = document.createElement("input");
    this.clipBoardElement.value = text;
    document.body.appendChild(this.clipBoardElement);
    this.clipBoardElement.focus();
    this.clipBoardElement.select();
  }
}
