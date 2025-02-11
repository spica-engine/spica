import {Component, forwardRef, Inject} from "@angular/core";
import {ControlValueAccessor, NG_VALUE_ACCESSOR} from "@angular/forms";
import {INPUT_SCHEMA, InternalPropertySchema} from "../../input";

@Component({
  templateUrl: "./textarea.component.html",
  styleUrls: ["./textarea.component.scss"],
  viewProviders: [
    {provide: NG_VALUE_ACCESSOR, multi: true, useExisting: forwardRef(() => TextAreaComponent)}
  ]
})
export class TextAreaComponent implements ControlValueAccessor {
  value: string;
  disabled: boolean = false;
  _onChangeFn = (_: string) => {};
  _onTouchedFn = () => {};

  constructor(@Inject(INPUT_SCHEMA) public schema: InternalPropertySchema) {}

  writeValue(val: string): void {
    this.value = val;
    if (this.value === undefined && this.schema.default) {
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
