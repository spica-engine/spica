import {Injectable} from "@nestjs/common";
import {Validator} from "@spica-server/core/schema";
import {FunctionEngine} from "../engine";
import {isObservable, Observable} from "rxjs";
import {JSONSchema7} from "json-schema";
import {skip, take, tap} from "rxjs/operators";
import fnSchema = require("./function.json");

@Injectable()
export class EnqueuerSchemaResolver {
  enqueuerPrefix = "http://spica.internal/function/enqueuer";

  constructor(private registry: FunctionEngine, private validator: Validator) {
    const enqueuerIds = Array.from(this.registry.schemas.keys()).map(
      e => `${this.enqueuerPrefix}/${e}`
    );
    this.addEnqueuersToSchema(enqueuerIds);
  }

  private addEnqueuersToSchema(enqueuerIds: string[]) {
    fnSchema.properties.triggers.patternProperties[""].properties.options = {
      oneOf: enqueuerIds.map(id => {
        return {$ref: id};
      })
    } as any;
  }

  resolve(uri: string): Promise<object> | Observable<JSONSchema7 | null> | undefined {
    if (uri == "http://spica.internal/function/schema") {
      return Promise.resolve(fnSchema);
    }

    const [, enqueuer] = /http:\/\/spica\.internal\/function\/enqueuer\/(.*)/g.exec(uri);

    const schema = this.registry.getSchema(enqueuer, true);
    if (!schema) {
      console.warn(`Couldn't find the enqueuer with name ${enqueuer}`);
      return;
    }

    if (isObservable(schema)) {
      const promise = schema.pipe(take(1)).toPromise();

      schema
        .pipe(
          skip(1),
          take(1),
          tap(schema => {
            // we should remove enqueuer and function schema in order to force schema validator to re-create it
            this.validator.removeSchema(fnSchema.$id);
            this.validator.removeSchema(schema.$id);
          })
        )
        .subscribe();

      return promise;
    }
    return schema;
  }
}

export async function provideEnqueuerSchemaResolver(validator: Validator, engine: FunctionEngine) {
  const resolver = new EnqueuerSchemaResolver(engine, validator);
  validator.registerUriResolver(uri => resolver.resolve(uri));
  return resolver;
}
