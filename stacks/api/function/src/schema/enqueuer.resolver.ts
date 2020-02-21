import {Injectable} from "@nestjs/common";
import {Validator} from "@spica-server/core/schema";
import {FunctionEngine} from "../engine";
import {Function} from "../interface";

// TODO(thesayyn): Provide a schema invalidator
// in order to catch up latest schemas from triggers
@Injectable()
export class EnqueuerSchemaResolver {
  constructor(private registry: FunctionEngine) {}

  resolve(uri: string): Promise<object> | undefined {
    const match = /http:\/\/spica\.internal\/function\/enqueuer\/(.*)/g.exec(uri);

    if (this.registry.schemas.has(match[1])) {
      return this.registry.getSchema(match[1]);
    } else {
      console.warn(`Couldn't find the enqueuer with name ${match[1]}`);
    }
  }
}

export async function provideEnqueuerSchemaResolver(validator: Validator, engine: FunctionEngine) {
  const resolver = new EnqueuerSchemaResolver(engine);
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
            properties: Object.keys(body.triggers).reduce((props, key) => {
              props[key] = {
                type: "object",
                required: ["type"],
                properties: {
                  type: {
                    type: "string"
                  },
                  active: {
                    type: "boolean",
                    default: true
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
