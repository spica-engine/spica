import {HttpException} from "@nestjs/common";
import {ARRAY, BOOLEAN, DATE, DEFAULT, JSONP, JSONPR, NUMBER, OR, BooleanCheck} from "@spica/core";

describe("core pipes", () => {
  describe("NUMBER pipe", () => {
    it("should convert string into number", () => {
      const result = NUMBER.transform("1", undefined);
      expect(typeof result).toBe("number");
      expect(result).toBe(1);
    });
  });

  describe("JSONP pipe", () => {
    it("should parse json string", () => {
      let result = JSONP.transform('{ "test": 1 }', undefined);
      expect(result).not.toBe(null);
      expect(typeof result).toBe("object");
      expect(result).toEqual({test: 1});

      result = JSONP.transform("[1,2,3]", undefined);

      expect(Array.isArray(result)).toBe(true);
      expect(result).toEqual([1, 2, 3]);
    });

    it("should throw BadRequestException when given json is invalid", () => {
      expect(() => {
        JSONP.transform('*{"key":"value"}', undefined);
      }).toThrow(new HttpException("Unexpected token * in JSON at position 0", 400));
    });
  });

  describe("JSONPR pipe", () => {
    it("should pass the reviver", () => {
      const reviver = jasmine.createSpy("reviver").and.callFake((k, v) => {
        if (v == "supersecret") {
          return "**REDACTED**";
        }
        return v;
      });
      const pipe = JSONPR(reviver);
      const value = JSON.stringify({secret: "supersecret"});
      expect(pipe.transform(value, undefined)).toEqual({secret: "**REDACTED**"});
    });

    it("should  forward errors thrown by reviver", () => {
      const reviver = jasmine.createSpy("reviver").and.callFake((k, v) => {
        if (v == "__throw__") {
          throw new Error(`thrown __throw__`);
        }
        return v;
      });
      const pipe = JSONPR(reviver);
      const value = JSON.stringify({action: "__throw__"});
      expect(() => pipe.transform(value, undefined)).toThrowError("thrown __throw__");
    });
  });

  describe("BOOLEAN pipe", () => {
    it("should work with 1 - 0 string", () => {
      expect(BOOLEAN.transform("1", undefined)).toBe(true);
      expect(BOOLEAN.transform("0", undefined)).toBe(false);
    });

    it("should work with true - false string", () => {
      expect(BOOLEAN.transform("true", undefined)).toBe(true);
      expect(BOOLEAN.transform("false", undefined)).toBe(false);
    });

    it("should return default value if values is not 1 - 0 or true - false", () => {
      expect(BOOLEAN.transform("test", undefined)).toBe(false);
      expect(BOOLEAN.transform("non-boolean", undefined)).toBe(false);
    });
  });

  describe("DEFAULT pipe", () => {
    it("should return default value only value is undefined", () => {
      expect(DEFAULT(1).transform(undefined, undefined)).toBe(1);
      expect(DEFAULT(1).transform(10, undefined)).toBe(10);
      expect(DEFAULT(1).transform(null, undefined)).toBe(null);
    });

    it("should take and return default value only value is undefined", () => {
      let i = 1;

      const def = DEFAULT(() => ++i);

      expect(def.transform(undefined, undefined)).toBe(2);
      expect(def.transform(10, undefined)).toBe(10);
      expect(def.transform(undefined, undefined)).toBe(3);
    });
  });

  describe("DATE pipe", () => {
    it("should parse and return date from string", () => {
      const date = new Date();
      expect(DATE.transform(date.toISOString(), undefined).getTime()).toBe(date.getTime());
    });
  });

  describe("ARRAY pipe", () => {
    it("should convert non-array value to array", () => {
      const data = "test";
      expect(ARRAY(String).transform(data, undefined)).toEqual(["test"]);
    });

    it("should keep the array value as is", () => {
      const data = ["test", "test1"];
      expect(ARRAY(String).transform(data, undefined)).toEqual(["test", "test1"]);
    });

    it("should coerce the array items", () => {
      const data = ["1", "2"];
      expect(ARRAY(Number).transform(data, undefined)).toEqual([1, 2]);
    });

    it("should convert non-array value to array and coerce", () => {
      const data = "1";
      expect(ARRAY(Number).transform(data, undefined)).toEqual([1]);
    });
  });

  describe("OR pipe", () => {
    describe("boolean or string array", () => {
      it("should convert to the boolean", () => {
        let data = "true";
        expect(OR(BooleanCheck, BOOLEAN, ARRAY(String)).transform(data, undefined)).toEqual(true);

        data = "false";
        expect(OR(BooleanCheck, BOOLEAN, ARRAY(String)).transform(data, undefined)).toEqual(false);
      });

      it("should convert to the string array", () => {
        let data: any = "test";
        expect(OR(BooleanCheck, BOOLEAN, ARRAY(String)).transform(data, undefined)).toEqual([
          "test"
        ]);

        data = ["test", "test2"];
        expect(OR(BooleanCheck, BOOLEAN, ARRAY(String)).transform(data, undefined)).toEqual([
          "test",
          "test2"
        ]);
      });

      it("should work with default booleans", () => {
        let data = true;
        expect(OR(BooleanCheck, BOOLEAN, ARRAY(String)).transform(data, undefined)).toEqual(true);

        data = false;
        expect(OR(BooleanCheck, BOOLEAN, ARRAY(String)).transform(data, undefined)).toEqual(false);
      });
    });
  });
});
