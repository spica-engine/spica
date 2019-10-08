import {Component, forwardRef, HostListener, Inject} from "@angular/core";
import {ControlValueAccessor, NG_VALUE_ACCESSOR} from "@angular/forms";

import {INPUT_SCHEMA, InputSchema} from "../../input";

@Component({
  templateUrl: "./date.component.html",
  styleUrls: ["./date.component.scss"],
  providers: [{provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => DateComponent)}]
})
export class DateComponent implements ControlValueAccessor {
  _value: Date;
  _disabled: boolean = false;
  _onChangeFn: any;
  _onTouchedFn: any;

  constructor(@Inject(INPUT_SCHEMA) public schema: InputSchema) {}

  get value() {
    return this._value ? this._value.toISOString() : undefined;
  }

  set value(v: any) {
    this._value = v ? new Date(v) : undefined;
  }

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

  writeValue(val: any): void {
    this.value = val;
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
