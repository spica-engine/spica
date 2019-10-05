import {Component, forwardRef, Inject, ViewChild} from "@angular/core";
import {ControlValueAccessor, NG_VALUE_ACCESSOR, NgModel} from "@angular/forms";
import {InputPlacerOptions, INPUT_OPTIONS, INPUT_SCHEMA, InternalPropertySchema} from "../../input";

@Component({
  templateUrl: "./string.component.html",
  styleUrls: ["./string.component.scss"],
  providers: [{provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => StringComponent)}]
})
export class StringComponent implements ControlValueAccessor {
  value: string;
  disabled: boolean = false;
  _onChangeFn: Function = () => {};
  _onTouchedFn: Function = () => {};

  @ViewChild(NgModel, {static: false}) model: NgModel;

  constructor(
    @Inject(INPUT_SCHEMA) public schema: InternalPropertySchema,
    @Inject(INPUT_OPTIONS) public options: InputPlacerOptions
  ) {}

  writeValue(val: string): void {
    this.value = val;
    if (this.value == undefined && this.schema.default) {
      this.value = String(this.schema.default);
      this._onChangeFn(this.value);
    }
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
