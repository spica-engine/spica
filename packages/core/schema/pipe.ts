import {BadRequestException, Inject, mixin, PipeTransform, Type} from "@nestjs/common";
import {REQUEST} from "@nestjs/core";
import {ValidationError, Validator} from "./validator";

abstract class MixinValidator {
  abstract uriSchemaOrResolver: string | object | Function;
  constructor(public validator: Validator, @Inject(REQUEST) public req) {}
  transform(value: any) {
    let schema: object;
    if (typeof this.uriSchemaOrResolver == "function") {
      const res = this.uriSchemaOrResolver(this.req);
      schema = typeof res == "object" ? res : {$ref: res};
    } else if (typeof this.uriSchemaOrResolver == "string") {
      schema = {$ref: this.uriSchemaOrResolver};
    } else {
      schema = this.uriSchemaOrResolver;
    }

    return this.validator
      .validate(schema, value)
      .then(() => {
        this.validator.removeSchema("");
        return value;
      })
      .catch((error: ValidationError) => {
        this.validator.removeSchema("");
        throw new BadRequestException(
          error.message,
          (error.errors || []).map(e => `${e.dataPath} ${e.message}`).join("\n")
        );
      });
  }
}

export namespace Schema {
  export function validate(uri: string): Type<PipeTransform>;
  export function validate(schema: object): Type<PipeTransform>;
  export function validate(resolver: (req) => string): Type<PipeTransform>;
  export function validate(resolver: (req) => object): Type<PipeTransform>;
  export function validate(uriSchemaOrResolver: object | Function | string): Type<PipeTransform> {
    const pipe = mixin(
      class extends MixinValidator {
        uriSchemaOrResolver: string | object | Function = uriSchemaOrResolver;
      }
    );
    return pipe;
  }
}
