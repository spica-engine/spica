import {JSONSchema7} from "json-schema";
import {Validator} from "./validator";
import {Format} from "./interface";

describe("schema validator", () => {
  let validator: Validator;

  beforeEach(() => {
    validator = new Validator();
  });

  it("should fail with invalid format", () => {
    const schema: JSONSchema7 = {type: "string", format: "unknownformat"};
    expectAsync(validator.validate(schema, {})).toBeRejected();
  });

  it("should assign defaults", async () => {
    const data: any = {};
    const schema: JSONSchema7 = {
      type: "object",
      properties: {prop: {type: "string", default: "schema_default"}}
    };
    await expectAsync(validator.validate(schema, data)).toBeResolved(true);
    expect(data.prop).toBe("schema_default");
  });

  it("should assign dynamic default", async () => {
    validator.registerDefault({
      keyword: "dynamicdefault",
      type: "string",
      create: () => "dynamicvalue"
    });

    const data: any = {};
    const schema: JSONSchema7 = {
      type: "object",
      properties: {prop: {type: "string", default: "dynamicdefault"}}
    };
    await expectAsync(validator.validate(schema, data)).toBeResolved(true);
    expect(data.prop).toBe("dynamicvalue");
  });

  it("previous value should be passed correctly", async () => {
    const dynamicValueSpy = jasmine.createSpy().and.callFake(() => "dynamicvalue");
    validator.registerDefault({keyword: "created_at", type: "string", create: dynamicValueSpy});
    const schema: JSONSchema7 = {
      type: "object",
      properties: {prop: {type: "string", default: "created_at"}}
    };
    await expectAsync(validator.validate(schema, {})).toBeResolved(true);
    await expectAsync(validator.validate(schema, {prop: "prevvalue"})).toBeResolved(true);
    expect(dynamicValueSpy).toHaveBeenCalledTimes(2);
    expect(dynamicValueSpy.calls.first().args[0]).toBe(undefined);
    expect(dynamicValueSpy.calls.mostRecent().args[0]).toBe("prevvalue");
  });

  it("should call uri resolver", done => {
    const resolver = jasmine.createSpy();
    validator.registerUriResolver(resolver);
    validator.validate({$ref: "unknown-schema"}).then(done.fail, () => {
      expect(resolver).toHaveBeenCalledTimes(1);
      expect(resolver.calls.first().args[0]).toBe("unknown-schema");
      done();
    });
  });

  it("should resolve referenced schema and validate", async () => {
    const data: any = {};
    const schema: JSONSchema7 = {
      type: "object",
      properties: {
        property1: {type: "string", default: "default"},
        property2: {$ref: "http://spica.internal/schema"}
      }
    };
    const subschema: JSONSchema7 = {type: "string", default: "default"};
    const resolver = jasmine.createSpy().and.returnValue(Promise.resolve(subschema));
    validator.registerUriResolver(resolver);

    const valid = await validator.validate(schema, data);
    expect(valid).toBe(true);
    expect(resolver).toHaveBeenCalled();
    expect(resolver.calls.mostRecent().args[0]).toBe("http://spica.internal/schema");
    expect(data.property1).toBe("default");
    expect(data.property2).toBeUndefined();
  });

  it("should fail when trying to resolve unknown schema", () => {
    expectAsync(validator.validate({$ref: "unknown-schema"})).toBeRejected("unknown-schema");
  });

  describe("with format", () => {
    const schema = {
      type: "object",
      properties: {
        test: {
          type: "string",
          format: "myformat"
        }
      }
    };

    let spy: jasmine.Spy;

    beforeEach(() => {
      spy = jasmine.createSpy("validatefn").and.callFake(data => {
        return data == "formatted";
      });
      const format: Format = {
        name: "myformat",
        type: "string",
        validate: spy
      };
      validator = new Validator({formats: [format]});
    });

    it("should work with regex formats", () => {
      return expectAsync(
        validator.validate({type: "string", format: "date-time"}, "1963-06-19T08:30:06.283185Z")
      ).toBeResolved();
    });

    it("should pass validation", async () => {
      await expectAsync(validator.validate(schema, {test: "formatted"})).toBeResolved();
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy.calls.mostRecent().args[0]).toBe("formatted");
    });

    it("should not pass validation", async () => {
      await expectAsync(validator.validate(schema, {test: "nastyformatted"})).toBeRejected();
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy.calls.mostRecent().args[0]).toBe("nastyformatted");
    });

    it("should not do any operation if format type does not match with schema", () => {
      return expectAsync(
        validator.validate(
          {
            type: "object",
            properties: {
              test: {
                type: "number",
                format: "myformat"
              }
            }
          },
          {test: 123}
        )
      ).toBeResolved();
    });

    describe("and coercing", () => {
      it("should not coerce custom format", async () => {
        const spy = jasmine.createSpy("validatefn").and.callFake(data => data == "formatted");
        const format: Format = {
          name: "myformat",
          type: "string",
          validate: spy
        };
        const validator = new Validator({formats: [format]});

        const schema = {
          type: "object",
          properties: {
            test: {
              type: "string",
              format: "myformat"
            }
          }
        };
        const data = {
          test: "formatted"
        };

        await expectAsync(validator.validate(schema, data)).toBeResolved();
        expect(data.test).toBe("formatted");
        expect(spy).toHaveBeenCalledTimes(1);
        expect(spy.calls.mostRecent().args[0]).toBe("formatted");
      });

      it("should coerce custom format", async () => {
        const coerceSpy = jasmine.createSpy("coerce function").and.callFake(val => "test " + val);
        const validateSpy = jasmine
          .createSpy("validate function")
          .and.callFake(data => data == "formatted");
        const format: Format = {
          name: "myformat",
          type: "string",
          coerce: coerceSpy,
          validate: validateSpy
        };
        const validator = new Validator({formats: [format]});
        const data = {
          test: "formatted"
        };
        const schema = {
          type: "object",
          properties: {
            test: {
              type: "string",
              format: "myformat"
            }
          }
        };
        await expectAsync(validator.validate(schema, data)).toBeResolved();
        expect(data.test).toBe("test formatted");
        expect(coerceSpy).toHaveBeenCalledTimes(1);
        expect(coerceSpy.calls.mostRecent().args[0]).toBe("formatted");
        expect(validateSpy).toHaveBeenCalledTimes(1);
        expect(validateSpy.calls.mostRecent().args[0]).toBe("formatted");
      });
    });
  });
});
