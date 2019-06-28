import {Component, forwardRef, HostListener, Inject} from "@angular/core";
import {ControlValueAccessor, NG_VALUE_ACCESSOR} from "@angular/forms";

import {INPUT_OPTIONS, INPUT_SCHEMA, InputPlacerOptions, InputSchema} from "../../input";

@Component({
  templateUrl: "./string.component.html",
  styleUrls: ["./string.component.scss"],
  providers: [{provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => StringComponent)}]
})
export class StringComponent implements ControlValueAccessor {
  value: string;
  disabled: boolean = false;
  _onChangeFn: any;
  _onTouchedFn: any;

  constructor(
    @Inject(INPUT_SCHEMA) public schema: InputSchema,
    @Inject(INPUT_OPTIONS) public options: InputPlacerOptions
  ) {}

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

export interface StringSchema {
  type: string;
  title: string;
  description: string;
}
