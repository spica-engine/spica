import {Component, Input, OnInit} from "@angular/core";

@Component({
  selector: "input-language-selection",
  templateUrl: "./language-selection.component.html",
  styleUrls: ["./language-selection.component.scss"]
})
export class LanguageSelectionComponent implements OnInit {
  @Input() languages;
  @Input() fieldName;
  @Input() selectedLanguage;
  languageProperty = {
    isActive: false,
    name: ""
  };
  isAnimationActive = false;
  constructor() {}

  ngOnInit() {}
  languageAnimation(fieldName) {
    this.isAnimationActive = true;
    setTimeout(() => (this.isAnimationActive = false), (this.languages.length - 1) * 360);
    if (this.languageProperty.name === fieldName) {
      this.languageProperty.isActive = !this.languageProperty.isActive;
    } else {
      this.languageProperty.name = fieldName;
      this.languageProperty.isActive = true;
    }
  }
}
