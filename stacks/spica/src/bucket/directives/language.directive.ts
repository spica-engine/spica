import {Directive, Input} from "@angular/core";

@Directive({selector: "[language]", exportAs: "language"})
export class LanguageDirective {
  @Input() language: string;
}
