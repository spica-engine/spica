import {Directive, forwardRef, Input} from "@angular/core";
import {AbstractControl, NG_VALIDATORS, ValidationErrors, Validator} from "@angular/forms";
export const TRANSLATE: any = {
  provide: NG_VALIDATORS,
  useExisting: forwardRef(() => RequiredTranslate),
  multi: true
};

@Directive({
  selector:
    "[requiredTranslate][formControlName],[requiredTranslate][formControl],[requiredTranslate][ngModel]",
  providers: [TRANSLATE],
  host: {"[attr.requiredTranslate]": "requiredTranslate ? requiredTranslate : null"}
})
export class RequiredTranslate implements Validator {
  constructor() {}
  @Input() requiredTranslate: Object;
  @Input() currentLanguage: string;
  @Input() defaultLanguage: string;

  validate(control: AbstractControl): ValidationErrors | null {
    if (
      !this.defaultLanguage ||
      !this.currentLanguage ||
      (this.currentLanguage == this.defaultLanguage && !control.value) ||
      (this.defaultLanguage != this.currentLanguage &&
        !this.requiredTranslate[this.defaultLanguage])
    ) {
      return {requiredTranslate: true};
    }

    return null;
  }
}
