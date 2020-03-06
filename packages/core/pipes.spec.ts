import {BOOLEAN, DATE, DEFAULT, JSONP, NUMBER, ARRAY} from "./pipes";
import {HttpException} from "@nestjs/common";

describe("core pipes", () => {
  it("NUMBER pipe should convert string into number", () => {
    const result = NUMBER.transform("1", undefined);
    expect(typeof result).toBe("number");
    expect(result).toBe(1);
  });

  it("JSONP pipe should parse json string", () => {
    let result = JSONP.transform('{ "test": 1 }', undefined);
    expect(result).not.toBe(null);
    expect(typeof result).toBe("object");
    expect(result).toEqual({test: 1});

    result = JSONP.transform("[1,2,3]", undefined);

    expect(Array.isArray(result)).toBe(true);
    expect(result).toEqual([1, 2, 3]);
  });

  it("JSONP pipe should throw BadRequestException when given json is invalid", () => {
    expect(() => {
      JSONP.transform('*{"key":"value"}', undefined);
    }).toThrow(new HttpException("Unexpected token * in JSON at position 0", 400));
  });

  it("BOOLEAN pipe should work with 1 - 0 string", () => {
    expect(BOOLEAN.transform("1", undefined)).toBe(true);
    expect(BOOLEAN.transform("0", undefined)).toBe(false);
  });

  it("BOOLEAN pipe should work with true - false string", () => {
    expect(BOOLEAN.transform("true", undefined)).toBe(true);
    expect(BOOLEAN.transform("false", undefined)).toBe(false);
  });

  it("BOOLEAN pipe should return default value if values is not 1 - 0 or true - false", () => {
    expect(BOOLEAN.transform("test", undefined)).toBe(false);
    expect(BOOLEAN.transform("non-boolean", undefined)).toBe(false);
  });

  it("DEFAULT pipe should return default value only value is undefined", () => {
    expect(DEFAULT(1).transform(undefined, undefined)).toBe(1);
    expect(DEFAULT(1).transform(10, undefined)).toBe(10);
    expect(DEFAULT(1).transform(null, undefined)).toBe(null);
  });

  it("DEFAULT pipe should take and return default value only value is undefined", () => {
    let i = 1;

    const def = DEFAULT(() => ++i);

    expect(def.transform(undefined, undefined)).toBe(2);
    expect(def.transform(10, undefined)).toBe(10);
    expect(def.transform(undefined, undefined)).toBe(3);
  });

  it("DATE pipe should parse and return date from string", () => {
    const date = new Date();
    expect(DATE.transform(date.toISOString(), undefined).getTime()).toBe(date.getTime());
  });

  it("ARRAY should convert non-array value to array", () => {
    const data = "test";
    expect(ARRAY(String).transform(data, undefined)).toEqual(["test"]);
  });

  it("ARRAY should keep the array value as is", () => {
    const data = ["test", "test1"];
    expect(ARRAY(String).transform(data, undefined)).toEqual(["test", "test1"]);
  });

  it("ARRAY should coerce the array items", () => {
    const data = ["1", "2"];
    expect(ARRAY(Number).transform(data, undefined)).toEqual([1, 2]);
  });

  it("ARRAY should convert non-array value to array and coerce", () => {
    const data = "1";
    expect(ARRAY(Number).transform(data, undefined)).toEqual([1]);
  });
});
