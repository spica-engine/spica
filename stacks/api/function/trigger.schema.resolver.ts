import {Injectable} from "@nestjs/common";
import {Validator} from "@spica-server/core/schema";
import {EngineRegistry} from "./engine/registry";
import {Function} from "./interface";

// TODO(thesayyn): Provide a schema invalidator
// in order to catch up latest schemas from triggers
@Injectable()
export class TriggerSchemaResolver {
  constructor(private registry: EngineRegistry) {}

  resolve(uri: string): Promise<object> | undefined {
    const match = /http:\/\/spica\.internal\/function\/triggers\/(.*?)\/schema/g.exec(uri);
    if (match && this.registry.getTrigger(match[1])) {
      return this.registry.getTrigger(match[1]).schema();
    }
  }
}

export async function provideTriggerSchemaResolver(validator: Validator, registry: EngineRegistry) {
  const resolver = new TriggerSchemaResolver(registry);
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
            required: ["default"],
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
                    $ref: `http://spica.internal/function/triggers/${body.triggers[key].type}/schema`
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
