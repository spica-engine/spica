import {BadRequestException, Inject, mixin, PipeTransform, Type} from "@nestjs/common";
import {REQUEST} from "@nestjs/core";
import {ValidationError, Validator} from "./validator";

abstract class MixinValidator {
  abstract uriSchemaOrResolver: string | object | Function;
  constructor(public validator: Validator, @Inject(REQUEST) public req) {}

  transform(value: any) {
    let schema: object | string = this.uriSchemaOrResolver;
    if (typeof this.uriSchemaOrResolver == "function") {
      schema = this.uriSchemaOrResolver(this.req);
      if (!schema) {
        throw new TypeError(`resolve function has returned undefined`);
      }
    }
    return this.validator
      .validate(schema, value)
      .then(() => value)
      .catch(error => {
        throw new BadRequestException(
          error.errors
            ? error.errors
                .map(e => {
                  const dataPath = e.dataPath.replace(/\//g, ".");
                  return `${dataPath} ${e.message}`;
                })
                .join("\n")
            : [],
          error.message
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
