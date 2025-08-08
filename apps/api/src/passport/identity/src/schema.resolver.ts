import {Validator} from "../../../../../../libs/core/schema";
import {PreferenceService} from "../../../preference/services";

export class SchemaResolver {
  constructor(
    validator: Validator,
    private pref: PreferenceService
  ) {
    pref.watch("passport").subscribe(() => {
      validator.removeSchema("http://spica.internal/passport/update-identity-with-attributes");
      validator.removeSchema("http://spica.internal/passport/create-identity-with-attributes");
      validator.removeSchema("http://spica.internal/passport/identity-attributes");
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

        let schema = {
          $id: "http://spica.internal/passport/identity-attributes",
          type: "object",
          required,
          properties: {
            attributes: {
              type: "object",
              ...preference.identity.attributes
            }
          }
        };

        schema.properties.attributes = compileSchema(schema.properties.attributes);
        return compileSchema(schema);
      });
    }
  }
}
export async function provideSchemaResolver(validator: Validator, pref: PreferenceService) {
  const resolver = new SchemaResolver(validator, pref);
  validator.registerUriResolver(uri => resolver.resolve(uri));
  return resolver;
}

function compileSchema(schema) {
  if (typeof schema.properties == "object") {
    for (const key in schema.properties) {
      const spec = schema.properties[key];
      if (typeof spec == "object") {
        schema.properties[key] = mapProperty(spec);
      } else {
        console.debug(`ignoring boolean property at ${key}`);
      }
    }
  } else if (schema.items) {
    schema.items = mapProperty(schema.items);
  }

  return schema;
}

function mapProperty(property) {
  switch (property.type) {
    case "relation":
      if (property["relationType"] == "onetomany") {
        property.type = "array";
        property.items = {
          format: "objectid-string",
          type: "string"
        };
      } else {
        property.type = "string";
        property.format = "objectid-string";
      }

      break;
  }

  return property;
}
