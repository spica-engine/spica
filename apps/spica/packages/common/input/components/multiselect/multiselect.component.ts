import {Component, forwardRef, Inject} from "@angular/core";
import {ControlValueAccessor, NG_VALUE_ACCESSOR} from "@angular/forms";
import {INPUT_SCHEMA} from "../../input";

@Component({
  selector: "multiselect",
  templateUrl: "./multiselect.component.html",
  styleUrls: ["./multiselect.component.scss"],
  viewProviders: [
    {provide: NG_VALUE_ACCESSOR, multi: true, useExisting: forwardRef(() => MultiselectComponent)}
  ]
})
export class MultiselectComponent implements ControlValueAccessor {
  _value: unknown[];
  disabled: boolean = false;
  _onChangeFn: Function = () => {};
  _onTouchedFn: Function = () => {};

  constructor(@Inject(INPUT_SCHEMA) public schema: any) {}

  writeValue(val: unknown[]): void {
    this._value = val;
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
