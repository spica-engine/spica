import {Component, forwardRef, HostListener, Inject} from "@angular/core";
import {ControlValueAccessor, NG_VALUE_ACCESSOR} from "@angular/forms";

import {INPUT_SCHEMA, InternalPropertySchema} from "../../input";

@Component({
  templateUrl: "./object.component.html",
  styleUrls: ["./object.component.scss"],
  providers: [{provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => ObjectComponent)}]
})
export class ObjectComponent implements ControlValueAccessor {
  _value: Object = new Object();
  _disabled: boolean = false;
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
      this._onChangeFn(this._value);
    }
  }

  writeValue(val: string): void {
    if (val && typeof val === "object" && val !== null) {
      this._value = val;
    }
  }

  registerOnChange(fn: any): void {
    this._onChangeFn = fn;
  }

  registerOnTouched(fn: any): void {
    this._onTouchedFn = fn;
  }

  setDisabledState?(isDisabled: boolean): void {
    this._disabled = isDisabled;
  }
}
