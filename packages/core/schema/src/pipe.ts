// import {
//   BadRequestException,
//   Inject,
//   Injectable,
//   mixin,
//   PipeTransform,
//   Scope,
//   Type
// } from "@nestjs/common";
// import {REQUEST} from "@nestjs/core";
// import {Validator} from "./validator";

// abstract class MixinValidator implements PipeTransform {
//   abstract uriSchemaOrResolver: string | object | Function;
//   constructor(public validator: Validator, @Inject(REQUEST) public req) {}

//   transform(value: any) {
//     let schema: object | string = this.uriSchemaOrResolver;
//     if (typeof this.uriSchemaOrResolver == "function") {
//       schema = this.uriSchemaOrResolver(this.req);
//       if (!schema) {
//         throw new TypeError(`resolve function has returned undefined`);
//       }
//     }
//     return this.validator
//       .validate(schema, value)
//       .then(() => value)
//       .catch(error => {
//         throw new BadRequestException(
//           error.errors
//             ? error.errors
//                 .map(e => {
//                   const dataPath = e.dataPath.replace(/\//g, ".");
//                   return `${dataPath} ${e.message}`;
//                 })
//                 .join("\n")
//             : [],
//           error.message
//         );
//       });
//   }
// }

// export namespace Schema {
//   export function validate(uri: string): Type<PipeTransform>;
//   export function validate(schema: object): Type<PipeTransform>;
//   export function validate(resolver: (req) => string): Type<PipeTransform>;
//   export function validate(resolver: (req) => object): Type<PipeTransform>;
//   export function validate(uriSchemaOrResolver: object | Function | string): Type<PipeTransform> {
//     const pipe = mixin(
//       class extends MixinValidator {
//         uriSchemaOrResolver: string | object | Function = uriSchemaOrResolver;
//       }
//     );
//     return pipe;
//   }
// }

import {BadRequestException, Inject, mixin, PipeTransform, Type} from "@nestjs/common";
import {REQUEST} from "@nestjs/core";
import {Validator} from "./validator";

abstract class MixinValidator implements PipeTransform {
  abstract uriSchemaOrResolver: string | object;
  constructor(public validator: Validator) {}

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
    let pipe = mixin(
      class extends MixinValidator {
        uriSchemaOrResolver = uriSchemaOrResolver;
      }
    );

    if (typeof uriSchemaOrResolver == "function") {
      pipe = mixin(
        class extends MixinValidatorRequestScope {
          uriSchemaOrResolver = uriSchemaOrResolver;
        }
      );
    }

    return pipe;
  }
}
