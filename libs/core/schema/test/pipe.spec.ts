import {Schema, Validator} from "@spica/core";

describe("schema pipe", () => {
  it("should reject with ref", async () => {
    const validatorMixin = Schema.validate("test");
    const pipe = new validatorMixin(
      new Validator({
        schemas: [
          {
            $id: "ref",
            type: "object",
            properties: {test: {type: "string"}},
            additionalProperties: false
          },
          {
            $id: "test",
            $ref: "ref"
          }
        ]
      })
    );
    const data: object = {evil: "hahah"};

    await expectAsync(pipe.transform(data, undefined)).toBeRejectedWith(
      new Error("should NOT have additional properties 'evil'")
    );
  });

  describe("validation with schema", () => {
    let pipe;
    beforeAll(async () => {
      const validatorMixin = Schema.validate({type: "string"});
      pipe = new validatorMixin(new Validator());
    });

    it("should fail with validation errors", async () => {
      await expectAsync(pipe.transform({})).toBeRejected();
    });

    it("should pass the validation", async () => {
      await expectAsync(pipe.transform("")).toBeResolvedTo("");
    });
  });

  describe("validation with uri", () => {
    let pipe;

    beforeAll(() => {
      const validatorMixin = Schema.validate("schema-uri");
      const validator = new Validator();
      pipe = new validatorMixin(validator);
      validator.registerUriResolver(() => Promise.resolve({type: "string"}));
    });

    it("should fail with validation errors", async () => {
      await expectAsync(pipe.transform({})).toBeRejected();
    });

    it("should pass the validation", async () => {
      await expectAsync(pipe.transform("")).toBeResolvedTo("");
    });
  });

  describe("validation with dynamic schema", () => {
    let dynamicSchema: jasmine.Spy;
    let pipe;

    beforeEach(() => {
      dynamicSchema = jasmine.createSpy("dynamicSchema").and.returnValue({type: "string"});
      const validatorMixin = Schema.validate(dynamicSchema);
      pipe = new validatorMixin(new Validator(), {});
    });

    it("should pass validation", async () => {
      await expectAsync(pipe.transform("")).toBeResolved();
      expect(dynamicSchema).toHaveBeenCalledTimes(1);
      expect(dynamicSchema.calls.first().args[0]).toEqual({});
    });

    it("should not pass validation", async () => {
      await expectAsync(pipe.transform(true)).toBeRejected();
      expect(dynamicSchema).toHaveBeenCalledTimes(1);
      expect(dynamicSchema.calls.first().args[0]).toEqual({});
    });
  });

  describe("validation with dynamic uri", () => {
    let pipe;
    let uriResolver: jasmine.Spy;
    let dynamicUri: jasmine.Spy;
    const req: any = {};

    beforeEach(() => {
      dynamicUri = jasmine.createSpy("dynamic-uri").and.returnValue("schema-uri");
      uriResolver = jasmine
        .createSpy("uri-resolver")
        .and.returnValue(Promise.resolve({type: "string"}));
      const validatorMixin = Schema.validate(dynamicUri);
      const validator = new Validator();
      validator.registerUriResolver(uriResolver);
      pipe = new validatorMixin(validator, req);
    });

    it("should fail with validation errors", async () => {
      await expectAsync(pipe.transform({})).toBeRejected();
    });

    it("should pass the validation", async () => {
      await expectAsync(pipe.transform("")).toBeResolvedTo("");
    });

    it("should call dynamic uri function", async () => {
      await expectAsync(pipe.transform({})).toBeRejected();
      expect(dynamicUri).toHaveBeenCalled();
      expect(dynamicUri.calls.mostRecent().args[0]).toBe(req);
    });

    it("it should have called uri-resolver", async () => {
      await expectAsync(pipe.transform({})).toBeRejected();
      expect(uriResolver).toHaveBeenCalled();
      expect(uriResolver.calls.mostRecent().args[0]).toBe("schema-uri");
    });
  });
});
