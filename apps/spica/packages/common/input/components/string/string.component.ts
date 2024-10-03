import {
  Component,
  forwardRef,
  Inject,
  ViewChild,
  OnDestroy,
  OnInit,
  AfterViewInit
} from "@angular/core";
import {ControlValueAccessor, NgModel, NG_VALUE_ACCESSOR} from "@angular/forms";
import {INPUT_SCHEMA, InternalPropertySchema} from "../../input";

@Component({
  templateUrl: "./string.component.html",
  styleUrls: ["./string.component.scss"],
  viewProviders: [
    {provide: NG_VALUE_ACCESSOR, multi: true, useExisting: forwardRef(() => StringComponent)}
  ]
})
export class StringComponent implements ControlValueAccessor {
  value: string;
  disabled: boolean = false;

  _onChangeFn = (_: string) => {};
  _onTouchedFn = () => {};

  @ViewChild(NgModel) model: NgModel;

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

export interface StringSchema {
  type: string;
  title: string;
  description: string;
}
