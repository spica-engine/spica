import {BadRequestException, Inject, mixin, Optional, PipeTransform, Type} from "@nestjs/common";
import {REQUEST} from "@nestjs/core";
import {Validator} from "./validator";

abstract class MixinValidator implements PipeTransform {
  abstract uriSchemaOrResolver: string | object;
  constructor(@Optional() public validator: Validator) {}

  transform(value: any) {
    let schema: object | string = this.uriSchemaOrResolver;

    return this.validator
      .validate(schema, value)
      .then(() => value)
      .catch(error => {
        throw new BadRequestException(
          error.errors
            ? error.errors
                .map(e => {
                  return buildErrorMessage(e);
                })
                .join("\n")
            : [],
          error.message
        );
      });
  }
}

function buildErrorMessage(e) {
  let dataPath = e.dataPath.replace(/\//g, ".");

  if (!dataPath && e.params && e.params.additionalProperty) {
    return `${e.message} '${e.params.additionalProperty}'`;
  }
  return `${dataPath} ${e.message}`;
}

// we need to separate request injected validator and base validator
// because injecting request makes this validator request scoped
// any class depends on this validator(especially controllers for request body validation) will become request scoped too
// it is described in here: https://docs.nestjs.com/fundamentals/injection-scopes#scope-hierarchy
// request scoped controllers will be constructed on each request, which will call your code on controller constructor for each request, also it impacts performance
// temporary solution is using base validator if validator schema is not dependent on request
abstract class MixinValidatorRequestScope extends MixinValidator {
  constructor(public validator: Validator, @Inject(REQUEST) public req) {
    super(validator);
  }

  transform(value: any) {
    this.uriSchemaOrResolver = (this.uriSchemaOrResolver as Function)(this.req);
    if (!this.uriSchemaOrResolver) {
      throw new TypeError(`resolve function has returned undefined`);
    }

    return super.transform(value);
  }
}

export namespace Schema {
  export function validate(uri: string): Type<PipeTransform>;
  export function validate(schema: object): Type<PipeTransform>;
  export function validate(resolver: (req) => string): Type<PipeTransform>;
  export function validate(resolver: (req) => object): Type<PipeTransform>;
  export function validate(uriSchemaOrResolver: object | Function | string): Type<PipeTransform> {
    if (typeof uriSchemaOrResolver == "function") {
      return mixin(
        class extends MixinValidatorRequestScope {
          uriSchemaOrResolver = uriSchemaOrResolver;
        }
      );
    } else {
      return mixin(
        class extends MixinValidator {
          uriSchemaOrResolver = uriSchemaOrResolver;
        }
      );
    }
  }
}
