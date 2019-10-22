import {UniqueItemsValidator} from "./validators";
import {FormControl} from "@angular/forms";

describe("Validators", () => {
  describe("UniqueItems", () => {
    let validator: UniqueItemsValidator;

    beforeEach(() => {
      validator = new UniqueItemsValidator();
    });

    it("should not return errors", () => {
      validator.items = ["ab", "cd"];
      expect(validator.validate(new FormControl("tset"))).toBeNull();
    });

    it("should return errors", () => {
      validator.items = ["ab", "cd"];
      validator.index = 2;
      expect(validator.validate(new FormControl("ab"))).toEqual({unique: [2]});
    });

    it("should not return errors when disabled", () => {
      validator.items = ["ab", "cd"];
      validator.index = 2;
      validator.uniqueItems = false;
      expect(validator.validate(new FormControl("ab"))).toBeNull();
    });
  });
});
