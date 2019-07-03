import {Directive, forwardRef, Input, OnChanges, SimpleChanges} from "@angular/core";
import {
  AbstractControl,
  NG_VALIDATORS,
  ValidationErrors,
  Validator,
  ValidatorFn,
  Validators
} from "@angular/forms";

export const MIN_VALIDATOR: any = {
  provide: NG_VALIDATORS,
  useExisting: forwardRef(() => MinValidator),
  multi: true
};

@Directive({
  selector: "[min][formControlName],[min][formControl],[min][ngModel]",
  providers: [MIN_VALIDATOR],
  host: {"[attr.min]": "min ? min : null"}
})
export class MinValidator implements Validator, OnChanges {
  private _validator: ValidatorFn;
  private _onChange: () => void;

  @Input() min: number;

  ngOnChanges(changes: SimpleChanges): void {
    if ("min" in changes) {
      this._createValidator();
      if (this._onChange) this._onChange();
    }
  }

  validate(control: AbstractControl): ValidationErrors | null {
    return this._validator(control);
  }

  registerOnValidatorChange(fn: () => void): void {
    this._onChange = fn;
  }

  private _createValidator(): void {
    this._validator = Validators.min(this.min);
  }
}

export const MAX_VALIDATOR: any = {
  provide: NG_VALIDATORS,
  useExisting: forwardRef(() => MaxValidator),
  multi: true
};

@Directive({
  selector: "[max][formControlName],[max][formControl],[max][ngModel]",
  providers: [MAX_VALIDATOR],
  host: {"[attr.max]": "max ? max : null"}
})
export class MaxValidator implements Validator, OnChanges {
  private _validator: ValidatorFn;
  private _onChange: () => void;

  @Input() max: number;

  ngOnChanges(changes: SimpleChanges): void {
    if ("max" in changes) {
      this._createValidator();
      if (this._onChange) this._onChange();
    }
  }

  validate(control: AbstractControl): ValidationErrors | null {
    return this._validator(control);
  }

  registerOnValidatorChange(fn: () => void): void {
    this._onChange = fn;
  }

  private _createValidator(): void {
    this._validator = Validators.max(this.max);
  }
}
