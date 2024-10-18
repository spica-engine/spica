import {Directive, forwardRef} from "@angular/core";
import {
  ControlValueAccessor,
  NG_VALUE_ACCESSOR,
  NG_VALIDATORS,
  Validator,
  AbstractControl,
  ValidationErrors
} from "@angular/forms";

@Directive({
  selector: "[ngModelArray]",
  exportAs: "arrayContainer",
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      multi: true,
      useExisting: forwardRef(() => ArrayControlContainer)
    },
    {
      provide: NG_VALIDATORS,
      multi: true,
      useExisting: forwardRef(() => ArrayControlContainer)
    }
  ]
})
export class ArrayControlContainer implements ControlValueAccessor, Validator {
  values: unknown[];

  _onChange = (val: unknown[]) => {};
  _onTouched = () => {};

  writeValue(val: any): void {
    if (Array.isArray(val)) {
      this.values = val;
    }
  }

  propagateChanges() {
    this._onChange(this.values);
  }

  registerOnChange(fn: any): void {
    this._onChange = fn;
  }

  registerOnTouched(fn: any): void {
    this._onTouched = fn;
  }

  validate(control: AbstractControl): ValidationErrors {
    const values = Array.isArray(control.value) ? control.value : [];
    const emptyItems = values
      .map((value, index) => ({value, index}))
      .filter(({value}) => value == undefined || value == null);

    return emptyItems.length < 1
      ? null
      : emptyItems.reduce(
          (error, item) => {
            error.emptyItems.push(item.index);
            return error;
          },
          {emptyItems: []}
        );
  }
}
