import {SimpleChange} from "@angular/core";
import {UntypedFormControl} from "@angular/forms";
import {
  MaxItemsValidator,
  MaxValidator,
  MinItemsValidator,
  MinValidator,
  UniqueItemsValidator
} from "./validators";

describe("Validators", () => {
  describe("uniqueItems", () => {
    let validator: UniqueItemsValidator;

    beforeEach(() => {
      validator = new UniqueItemsValidator();
    });

    it("should not return errors", () => {
      expect(validator.validate(new UntypedFormControl(["ab", "cd"]))).toBeNull();
    });

    it("should return errors", () => {
      expect(validator.validate(new UntypedFormControl(["ab", "ab"]))).toEqual({
        uniqueItems: [0, 1]
      });
    });

    it("should not return errors when disabled", () => {
      validator.uniqueItems = false;
      expect(validator.validate(new UntypedFormControl(["ab", "ab"]))).toBeNull();
    });
  });

  describe("min", () => {
    let validator: MinValidator;
    beforeEach(() => (validator = new MinValidator()));
    it("should not return errors", () => {
      validator.min = 2;
      validator.ngOnChanges({min: new SimpleChange(undefined, 2, true)});
      expect(validator.validate(new UntypedFormControl(2))).toBeNull();
      expect(validator.validate(new UntypedFormControl(100))).toBeNull();
    });

    it("should return errors", () => {
      validator.min = 2;
      validator.ngOnChanges({min: new SimpleChange(undefined, 2, true)});
      expect(validator.validate(new UntypedFormControl(1))).toEqual({min: {min: 2, actual: 1}});
    });
  });

  describe("max", () => {
    let validator: MaxValidator;
    beforeEach(() => (validator = new MaxValidator()));

    it("should not return errors", () => {
      validator.max = 3;
      validator.ngOnChanges({max: new SimpleChange(undefined, 3, true)});
      expect(validator.validate(new UntypedFormControl(3))).toBeNull();
      expect(validator.validate(new UntypedFormControl(2))).toBeNull();
    });

    it("should return errors", () => {
      validator.max = 3;
      validator.ngOnChanges({max: new SimpleChange(undefined, 3, true)});
      expect(validator.validate(new UntypedFormControl(4))).toEqual({max: {max: 3, actual: 4}});
    });
  });

  describe("maxItems", () => {
    let validator: MaxItemsValidator;
    beforeEach(() => (validator = new MaxItemsValidator()));

    it("should not return errors", () => {
      validator.maxItems = 3;
      expect(validator.validate(new UntypedFormControl(["12", "213", "213"]))).toBeNull();
    });

    it("should return errors", () => {
      validator.maxItems = 3;
      expect(validator.validate(new UntypedFormControl(["12", "213", "213", "123"]))).toEqual({
        maxItems: {max: 3, actual: 4}
      });
    });
  });

  describe("minItems", () => {
    let validator: MinItemsValidator;
    beforeEach(() => (validator = new MinItemsValidator()));

    it("should not return errors", () => {
      validator.minItems = 2;
      expect(validator.validate(new UntypedFormControl(["12", "213"]))).toBeNull();
    });

    it("should return errors", () => {
      validator.minItems = 2;
      expect(validator.validate(new UntypedFormControl(["12"]))).toEqual({
        minItems: {min: 2, actual: 1}
      });
    });
  });
});
