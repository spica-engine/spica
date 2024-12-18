import {Schema, Validator} from "@spica-server/core/schema";

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
    let dynamicSchema: jest.Mock;
    let pipe;

    beforeEach(() => {
      dynamicSchema = jest.fn(() => ({
        type: "string"
      }));
      const validatorMixin = Schema.validate(dynamicSchema);
      pipe = new validatorMixin(new Validator(), {});
    });

    it("should pass validation", async () => {
      await expectAsync(pipe.transform("")).toBeResolved();
      expect(dynamicSchema).toHaveBeenCalledTimes(1);
      expect(dynamicSchema.calls.first()[0]).toEqual({});
    });

    it("should not pass validation", async () => {
      await expectAsync(pipe.transform(true)).toBeRejected();
      expect(dynamicSchema).toHaveBeenCalledTimes(1);
      expect(dynamicSchema.calls.first()[0]).toEqual({});
    });
  });

  describe("validation with dynamic uri", () => {
    let pipe;
    let uriResolver: jest.Mock;
    let dynamicUri: jest.Mock;
    const req: any = {};

    beforeEach(() => {
      dynamicUri = jest.fn(() => "schema-uri");
      uriResolver = jest.fn(() => Promise.resolve({type: "string"}));
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
      expect(dynamicUri.mock.calls[dynamicUri.mock.calls.length - 1][0]).toBe(req);
    });

    it("it should have called uri-resolver", async () => {
      await expectAsync(pipe.transform({})).toBeRejected();
      expect(uriResolver).toHaveBeenCalled();
      expect(uriResolver.mock.calls[uriResolver.mock.calls.length - 1][0]).toBe("schema-uri");
    });
  });
});
