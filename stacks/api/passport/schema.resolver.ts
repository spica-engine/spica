import {Validator} from "@spica-server/core/schema";
import {PreferenceService} from "@spica-server/preference";

export class SchemaResolver {
  constructor(validator: Validator, private pref: PreferenceService) {
    pref.watch("passport").subscribe(() => {
      validator.removeSchema("http://spica.internal/passport/update-identity-with-attributes");
      validator.removeSchema("http://spica.internal/passport/create-identity-with-attributes");
    });
  }

  async resolve(uri: string) {
    if (uri == "http://spica.internal/passport/create-identity-with-attributes") {
      return {
        $id: "http://spica.internal/passport/create-identity-with-attributes",
        allOf: [
          {$ref: "http://spica.internal/passport/identity-create"},
          {$ref: "http://spica.internal/passport/identity-attributes"}
        ]
      };
    } else if (uri == "http://spica.internal/passport/update-identity-with-attributes") {
      return {
        $id: "http://spica.internal/passport/update-identity-with-attributes",
        allOf: [
          {$ref: "http://spica.internal/passport/identity"},
          {$ref: "http://spica.internal/passport/identity-attributes"}
        ]
      };
    } else if (uri == "http://spica.internal/passport/identity-attributes") {
      return this.pref.get("passport").then(preference => {
        // What we do here is we mark attributes property as required
        // if there is any required property in it otherwise there
        // should not be an attributes property at all.
        const required = [];
        if (
          preference.identity.attributes.required &&
          preference.identity.attributes.required.length
        ) {
          required.push("attributes");
        }
        return {
          type: "object",
          required,
          properties: {
            attributes: {
              type: "object",
              ...preference.identity.attributes
            }
          }
        };
      });
    }
  }
}
export async function provideSchemaResolver(validator: Validator, pref: PreferenceService) {
  const resolver = new SchemaResolver(validator, pref);
  validator.registerUriResolver(uri => resolver.resolve(uri));
  return resolver;
}
