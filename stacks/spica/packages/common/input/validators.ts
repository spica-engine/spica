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

export const UNIQUE_ITEMS_VALIDATOR: any = {
  provide: NG_VALIDATORS,
  useExisting: forwardRef(() => UniqueItemsValidator),
  multi: true
};

@Directive({
  selector: "[uniqueItems][formControlName],[uniqueItems][formControl],[uniqueItems][ngModel]",
  providers: [UNIQUE_ITEMS_VALIDATOR],
  host: {"[attr.unique-items]": "uniqueItems ? uniqueItems : null"}
})
export class UniqueItemsValidator implements Validator, OnChanges {
  private _onChange: () => void;

  @Input() uniqueItems: boolean;

  @Input() items: Array<any>;

  @Input() index: number;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes.uniqueItems || changes.items) {
      if (this._onChange) this._onChange();
    }
  }

  validate(control: AbstractControl): ValidationErrors | null {
    if (!Array.isArray(this.items) || !this.uniqueItems) {
      return null;
    }

    this.items[this.index] = control.value;

    const sameItems = this.items
      .map((value, index) => ({value, index}))
      .filter(({value, index}) => this.items.indexOf(value) != index);

    return sameItems.length < 1
      ? null
      : sameItems.reduce(
          (error, item) => {
            error.unique.push(item.index);
            return error;
          },
          {unique: []}
        );
  }

  registerOnValidatorChange(fn: () => void): void {
    this._onChange = fn;
  }
}

export const MIN_ITEMS_VALIDATOR: any = {
  provide: NG_VALIDATORS,
  useExisting: forwardRef(() => MinItemsValidator),
  multi: true
};

@Directive({
  selector: "[minItems][formControlName],[minItems][formControl],[minItems][ngModel]",
  providers: [MIN_ITEMS_VALIDATOR],
  host: {"[attr.min-items]": "minItems ? minItems : null"}
})
export class MinItemsValidator implements Validator, OnChanges {
  private _onChange: () => void;

  @Input() minItems: number;

  @Input() items: Array<any>;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes.minItems || changes.items) {
      if (this._onChange) this._onChange();
    }
  }

  validate(control: AbstractControl): ValidationErrors | null {
    if (!Array.isArray(this.items) || !this.minItems || this.items.length >= this.minItems) {
      return null;
    }

    return {minItems: {expected: this.minItems, current: this.items.length}};
  }

  registerOnValidatorChange(fn: () => void): void {
    this._onChange = fn;
  }
}

export const MAX_ITEMS_VALIDATOR: any = {
  provide: NG_VALIDATORS,
  useExisting: forwardRef(() => MaxItemsValidator),
  multi: true
};

@Directive({
  selector: "[maxItems][formControlName],[maxItems][formControl],[maxItems][ngModel]",
  providers: [MAX_ITEMS_VALIDATOR],
  host: {"[attr.max-items]": "maxItems ? maxItems : null"}
})
export class MaxItemsValidator implements Validator, OnChanges {
  private _onChange: () => void;

  @Input() maxItems: number;

  @Input() items: Array<any>;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes.maxItems || changes.items) {
      if (this._onChange) this._onChange();
    }
  }

  validate(control: AbstractControl): ValidationErrors | null {
    if (!Array.isArray(this.items) || !this.maxItems || this.items.length <= this.maxItems) {
      return null;
    }

    return {maxItems: {expected: this.maxItems, current: this.items.length}};
  }

  registerOnValidatorChange(fn: () => void): void {
    this._onChange = fn;
  }
}
