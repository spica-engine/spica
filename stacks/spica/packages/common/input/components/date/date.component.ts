import {Component, forwardRef, Inject} from "@angular/core";
import {ControlValueAccessor, NG_VALUE_ACCESSOR} from "@angular/forms";
import {INPUT_SCHEMA, InternalPropertySchema} from "../../input";

@Component({
  templateUrl: "./date.component.html",
  styleUrls: ["./date.component.scss"],
  viewProviders: [
    {provide: NG_VALUE_ACCESSOR, multi: true, useExisting: forwardRef(() => DateComponent)}
  ]
})
export class DateComponent implements ControlValueAccessor {
  _value: Date;
  _disabled: boolean = false;
  _onChangeFn = (_: Date) => {};
  _onTouchedFn = () => {};

  constructor(@Inject(INPUT_SCHEMA) public schema: InternalPropertySchema) {}

  keyPress(event: KeyboardEvent) {
    if (event.keyCode == 8 /* Backspace */ && !this._value) {
      this._onChangeFn(undefined);
    }
  }

  writeValue(val: any): void {
    this._value = val && new Date(val);
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
