import {Injectable} from "@nestjs/common";
import {Validator} from "@spica-server/core/schema";
import {FunctionEngine} from "../engine";
import {Function} from "@spica/interface";

@Injectable()
export class EnqueuerSchemaResolver {
  enqueuerPrefix = "http://spica.internal/function/enqueuer";

  constructor(private registry: FunctionEngine, private validator: Validator) {}

  resolve(uri: string): Promise<object> | undefined {
    const match = /http:\/\/spica\.internal\/function\/enqueuer\/(.*)/g.exec(uri);

    if (this.registry.schemas.has(match[1])) {
      return this.registry.getSchema(match[1]).then(schema => {
        // remove schema right after it's used.
        setImmediate(() => this.validator.removeSchema(schema.$id));
        return schema;
      });
    } else {
      console.warn(`Couldn't find the enqueuer with name ${match[1]}`);
    }
  }
}

export async function provideEnqueuerSchemaResolver(validator: Validator, engine: FunctionEngine) {
  const resolver = new EnqueuerSchemaResolver(engine, validator);
  validator.registerUriResolver(uri => resolver.resolve(uri));
  return resolver;
}

// Maybe later we can write a custom keyword for this
export function generate({body}: {body: Function}) {
  return {
    type: "object",
    allOf: [
      {$ref: "http://spica.internal/function/schema"},
      {
        type: "object",
        properties: {
          triggers: {
            type: "object",
            minProperties: 1,
            description:
              "Allows defining which code part will be executed when which condition is met",
            properties: Object.keys(body.triggers).reduce((props, key) => {
              props[key] = {
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
                    $ref: `http://spica.internal/function/enqueuer/${body.triggers[key].type}`
                  }
                }
              };
              return props;
            }, {})
          }
        }
      }
    ]
  };
}
