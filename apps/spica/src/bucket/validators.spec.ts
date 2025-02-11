import {UntypedFormControl} from "@angular/forms";
import {RequiredTranslate} from "./validators";

describe("Validators", () => {
  describe("RequiredTranslate", () => {
    let validator: RequiredTranslate;

    beforeEach(() => {
      validator = new RequiredTranslate();
      validator.currentLanguage = "en_US";
      validator.defaultLanguage = "tr_TR";
    });

    it("should not return error when default language is filled", () => {
      validator.requiredTranslate = {
        en_US: "Test",
        tr_TR: "test"
      };
      expect(validator.validate(new UntypedFormControl("test"))).toBeNull();
    });

    it("should return error when default language is not filled", () => {
      validator.requiredTranslate = {
        en_US: "Test",
        tr_TR: ""
      };
      expect(validator.validate(new UntypedFormControl("test"))).toEqual({requiredTranslate: true});
    });

    it("should return error when current language is default language and control value is empty", () => {
      validator.currentLanguage = "tr_TR";
      validator.requiredTranslate = {
        en_US: "Test",
        tr_TR: ""
      };
      expect(validator.validate(new UntypedFormControl(""))).toEqual({requiredTranslate: true});
    });

    it("should not return error when current language is default language and control value is not empty", () => {
      validator.currentLanguage = "tr_TR";
      validator.requiredTranslate = {
        en_US: "Test",
        tr_TR: ""
      };
      expect(validator.validate(new UntypedFormControl("test"))).toBeNull();
    });
  });
});
