import {Component, forwardRef, HostListener, Inject} from "@angular/core";
import {NG_VALUE_ACCESSOR} from "@angular/forms";
import {INPUT_SCHEMA, InternalPropertySchema} from "../../input";

@Component({
  templateUrl: "./color.component.html",
  styleUrls: ["./color.component.scss"],
  providers: [{provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => ColorComponent)}]
})
export class ColorComponent {
  value: string;
  disabled: boolean = false;
  _onChangeFn: any;
  _onTouchedFn: any;

  constructor(@Inject(INPUT_SCHEMA) public schema: InternalPropertySchema) {}

  @HostListener("click")
  callOnTouched(): void {
    if (this._onTouchedFn) {
      this._onTouchedFn();
    }
  }

  callOnChange() {
    if (this._onChangeFn) {
      this._onChangeFn(this.value);
    }
  }

  writeValue(val: string): void {
    this.value = val;
  }
  registerOnChange(fn: any): void {
    this._onChangeFn = fn;
  }
  registerOnTouched(fn: any): void {
    this._onTouchedFn = fn;
  }
  setDisabledState?(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }
}
