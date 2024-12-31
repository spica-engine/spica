import {Directive, forwardRef, HostListener, Input, OnDestroy} from "@angular/core";
import {ControlValueAccessor, NG_VALUE_ACCESSOR} from "@angular/forms";
import {MatLegacyDialog as MatDialog, MatLegacyDialogRef as MatDialogRef} from "@angular/material/legacy-dialog";
import {Storage} from "../../interfaces/storage";
import {PickerOptions} from "./interfaces";
import {PickerComponent} from "./picker.component";

@Directive({
  selector: "[storagePicker]",
  exportAs: "storagePicker",
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      multi: true,
      useExisting: forwardRef(() => PickerDirective)
    }
  ]
})
export class PickerDirective implements OnDestroy, ControlValueAccessor {
  @Input("storagePicker") options: PickerOptions = {};

  private _dialogRef: MatDialogRef<PickerComponent, any>;

  private _onTouchedFn: () => void;
  private _onChangeFn: (v: Storage) => void;

  constructor(private dialog: MatDialog) {}

  writeValue(obj: any): void {}

  registerOnChange(fn: any): void {
    this._onChangeFn = fn;
  }

  registerOnTouched(fn: any): void {
    this._onTouchedFn = fn;
  }

  @HostListener("click")
  open(): void {
    if (this._onTouchedFn) {
      this._onTouchedFn();
    }
    this._dialogRef = this.dialog.open(PickerComponent, {
      panelClass: "storage-picker",
      minWidth: "80%",
      maxHeight: "90vh"
    });

    this._dialogRef
      .afterClosed()
      .toPromise()
      .then((r: Storage) => this._onChangeFn(r));
  }

  close(): void {
    if (this._dialogRef) {
      this._dialogRef.close();
      this._dialogRef = undefined;
    }
  }

  ngOnDestroy(): void {
    this.close();
  }
}
