import {Component, forwardRef, Inject} from "@angular/core";
import {ControlValueAccessor, NG_VALUE_ACCESSOR} from "@angular/forms";
import {INPUT_SCHEMA, InternalPropertySchema} from "../../input";

@Component({
  templateUrl: "./number.component.html",
  styleUrls: ["./number.component.scss"],
  viewProviders: [
    {provide: NG_VALUE_ACCESSOR, multi: true, useExisting: forwardRef(() => NumberComponent)}
  ]
})
export class NumberComponent implements ControlValueAccessor {
  value: number;
  disabled: boolean = false;
  _onChangeFn = (_: number) => {};
  _onTouchedFn = () => {};

  constructor(@Inject(INPUT_SCHEMA) public schema: InternalPropertySchema) {}

  writeValue(val: number): void {
    this.value = val;
    if (
      this.value !== null &&
      !Number.isFinite(this.value) &&
      this.schema.default !== undefined &&
      this.schema.default !== null
    ) {
      this.value = Number(this.schema.default);
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
