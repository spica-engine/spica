import {Injectable} from "@nestjs/common";
import {Validator} from "@spica-server/core/schema";
import {FunctionEngine} from "../engine";
import {Function} from "@spica-server/function/services";
import {combineLatest, isObservable, Observable} from "rxjs";
import {JSONSchema7} from "json-schema";
import {filter, skip, take, tap} from "rxjs/operators";

const complete_schema = {
  $id: "http://spica.internal/function/complete-schema",
  type: "object",
  allOf: [
    {$ref: "http://spica.internal/function/schema"},
    {
      type: "object",
      properties: {
        triggers: {
          type: "object",
          minProperties: 1,
          description: "Allows defining which function will invoke when which condition meets",
          patternProperties: {
            "": {
              type: "object",
              required: ["type", "options"],
              additionalProperties: false,
              properties: {
                type: {
                  type: "string",
                  description: "Type of the trigger"
                },
                active: {
                  type: "boolean",
                  default: true,
                  description: "Whether trigger is active"
                },
                options: {
                  oneOf: [
                    {
                      $ref: "http://spica.internal/function/enqueuer/http"
                    },
                    {
                      $ref: "http://spica.internal/function/enqueuer/firehose"
                    },
                    {
                      $ref: "http://spica.internal/function/enqueuer/schedule"
                    },
                    {
                      $ref: "http://spica.internal/function/enqueuer/system"
                    },
                    {
                      $ref: "http://spica.internal/function/enqueuer/database"
                    }
                  ]
                }
              }
            }
          }
        }
      }
    }
  ]
};

@Injectable()
export class EnqueuerSchemaResolver {
  enqueuers = new Map<string, Observable<JSONSchema7> | Promise<JSONSchema7>>();
  constructor(private registry: FunctionEngine, private validator: Validator) {}

  resolve(uri: string): Promise<object> | Observable<JSONSchema7 | null> | undefined {
    const [, enqueuer] = /http:\/\/spica\.internal\/function\/enqueuer\/(.*)/g.exec(uri);

    let schema = this.enqueuers.get(enqueuer);
    if (!schema) {
      schema = this.registry.getSchema(enqueuer);
      if (!schema) {
        console.warn(`Couldn't find the enqueuer with name ${enqueuer}`);
        return;
      }
      this.enqueuers.set(enqueuer, schema);
    }

    if (isObservable(schema)) {
      const promise = schema.pipe(take(1)).toPromise();
      schema
        .pipe(
          skip(1),
          take(1),
          tap(schema => {
            // we should remove enqueuer and function schema in order to force schema validator to re-create it
            this.validator.removeSchema(complete_schema.$id);
            this.validator.removeSchema(schema.$id);
          })
        )
        .subscribe();

      return promise;
    }
    return schema
  }
}

export async function provideEnqueuerSchemaResolver(validator: Validator, engine: FunctionEngine) {
  const resolver = new EnqueuerSchemaResolver(engine, validator);
  validator.registerUriResolver(uri => resolver.resolve(uri));
  return resolver;
}

// Maybe later we can write a custom keyword for this
export function generate({body}: {body: Function}) {
  return complete_schema;
}
