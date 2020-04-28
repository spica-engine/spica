import {
  Directive,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  Optional,
  Output
} from "@angular/core";
import {MatSortHeader} from "@angular/material";

@Directive({
  selector: "[mat-resize-header]",
  exportAs: "matResizeHeader",
  host: {
    "[style.padding-right.px]": "size",
    "[style.width.px]": "_width",
    "[style.cursor]": "_cursor",
    "[attr.disabled]": "_isDragging",
    "(mousedown)": "mouseDown($event)",
    "(mouseup)": "mouseUp()",
    "(mousemove)": "mouseMove($event)",
    "(mouseover)": "mouseOver($event)"
  }
})
export class MatResizeHeader {
  @Input() size: number = 100;

  @Output() resize = new EventEmitter<number>();

  @Output() resizeend = new EventEmitter<number>();

  _width: number;

  _cursor: string;

  private _startX: number;
  private _startWidth: number;

  private get _isDragging() {
    return this._startX != undefined && this._startWidth != undefined;
  }

  private get _rect() {
    return this.elem.nativeElement.getBoundingClientRect();
  }

  constructor(
    private elem: ElementRef<HTMLTableColElement>,
    @Optional() private matSort: MatSortHeader
  ) {}

  @HostListener("mousedown", ["$event"])
  mouseDown(event: MouseEvent) {
    const isInMovementRect = this.getIsInMovementRect(event.screenX);
    if (isInMovementRect) {
      this._startX = event.screenX;
      this._startWidth = (<HTMLTableColElement>event.target).clientWidth;
    }
  }

  @HostListener("mouseup")
  mouseUp() {
    if (this._startWidth != this._width) {
      this.resizeend.emit(this._width);
    }
    this._startX = this._startWidth = undefined;
    this.setMatSortDisabled(false);
  }

  @HostListener("mouseover", ["$event"])
  mouseOver(event: MouseEvent) {
    const isInMovementRect = this.getIsInMovementRect(event.screenX);
    this._cursor = isInMovementRect ? "col-resize" : undefined;
    this.setMatSortDisabled(isInMovementRect);
  }

  @HostListener("mousemove", ["$event"])
  mouseMove(event: MouseEvent) {
    if (this._isDragging) {
      const diff = event.screenX - this._startX;
      if (diff != 0) {
        this._width = this._startWidth + diff;
        this.resize.emit(this._width);
      }
    }
  }

  getIsInMovementRect(x: number) {
    return this._rect.left + this._rect.width - x < this.size;
  }

  setMatSortDisabled(disabled: boolean) {
    if (this.matSort) {
      this.matSort.disabled = disabled;
    }
  }
}
