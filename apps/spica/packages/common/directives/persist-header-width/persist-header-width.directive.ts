import {Directive, Input, OnChanges, SimpleChanges, EventEmitter, Output} from "@angular/core";
import {MatLegacyColumnDef as MatColumnDef} from "@angular/material/legacy-table";

@Directive({
  selector: "[persist-header-width]",
  host: {
    "(resizeend)": "resizeEnd($event)"
  }
})
export class PersistHeaderWidthDirective implements OnChanges {
  @Input("persist-header-width") bucket: string;

  @Output() _resize = new EventEmitter();

  private get _key(): string {
    return `${this.bucket}-${this.columnDef.name}`;
  }

  private get _persistedWidth(): number | undefined {
    const width = localStorage.getItem(this._key);
    if (width == null) {
      return undefined;
    }
    return Number(width);
  }

  private set _persistedWidth(val: number) {
    localStorage.setItem(this._key, String(val));
  }

  constructor(private columnDef: MatColumnDef) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes.bucket) {
      const desiredWidth = this._persistedWidth;
      if (desiredWidth != undefined) {
        this._resize.emit(desiredWidth);
      }
    }
  }

  resizeEnd(finalWidth: number) {
    this._persistedWidth = finalWidth;
  }
}
