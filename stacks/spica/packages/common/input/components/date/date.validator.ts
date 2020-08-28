import {Directive, forwardRef, Input, OnChanges, SimpleChanges} from "@angular/core";
import {AbstractControl, NG_VALIDATORS, ValidationErrors, Validator} from "@angular/forms";

@Directive({
  selector: "[date]",
  providers: [
    {
      provide: NG_VALIDATORS,
      multi: true,
      useExisting: forwardRef(() => DateValidatorDirective)
    }
  ]
})
export class DateValidatorDirective implements Validator, OnChanges {
  @Input() date = true;

  _onValidatorChange = () => {};

  ngOnChanges(changes: SimpleChanges): void {
    if (changes.date) {
      this._onValidatorChange();
    }
  }

  validate(control: AbstractControl): ValidationErrors {
    if (!control.value || (control.value && control.value instanceof Date) || !this.date) {
      return null;
    }
    return {date: true};
  }

  registerOnValidatorChange?(fn: () => void): void {
    this._onValidatorChange = fn;
  }
}
