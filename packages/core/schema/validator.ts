import {Inject, Injectable, Optional} from "@nestjs/common";
import * as ajv from "ajv";
import * as request from "request-promise-native";
import {from} from "rxjs";
import {
  Default,
  Format,
  GLOBAL_SCHEMA_MODULE_OPTIONS,
  ModuleOptions,
  SCHEMA_MODULE_OPTIONS,
  UriResolver
} from "./interface";
export {ValidationError} from "ajv";

@Injectable()
export class Validator {
  private _ajv: ajv.Ajv;
  private _resolvers = new Set<UriResolver>();
  private _defaults: Map<string, Default>;

  public get defaults(): Array<Default> {
    return Array.from(this._defaults.values());
  }

  constructor(
    @Inject(SCHEMA_MODULE_OPTIONS) local: ModuleOptions = {},
    @Optional() @Inject(GLOBAL_SCHEMA_MODULE_OPTIONS) global: ModuleOptions = {}
  ) {
    this._defaults = new Map<string, Default>(
      [...(local.defaults || []), ...(global.defaults || [])].map(def => [def.keyword, def] as any)
    );
    this._ajv = new ajv({
      removeAdditional: true,
      async: true,
      useDefaults: true,
      validateSchema: false,
      loadSchema: uri => this._fetch(uri),
      formats: [...(local.formats || []), ...(global.formats || [])].reduce((formats, format) => {
        formats[format.name] = format;
        return formats;
      }, {}),
      schemas: [...(local.schemas || []), ...(global.schemas || [])]
    });
    [...(local.keywords || []), ...(global.keywords || [])].forEach(keyword =>
      this.registerKeyword(keyword.name, keyword)
    );
    this.registerKeyword("default", {
      modifying: true,
      compile: (schema, parentSchema, it) => {
        return (data, dataPath, parentData) => {
          const defaultValueHandler = this._defaults.get(schema);
          // TODO(thesayyn): Check type of the default value handler against schema type;
          if (defaultValueHandler) {
            const propertyName = dataPath.split(".").filter(r => !!r)[it.dataLevel - 1];
            parentData[propertyName] = defaultValueHandler.create(
              data == defaultValueHandler.keyword ? undefined : data
            );
          }
          return true;
        };
      }
    });

    this.registerKeyword("format", {
      modifying: true,
      errors: true,
      compile: (schema, parentSchema, it) => {
        return function validateFn(data, dataPath, parentData) {
          if (!data) {
            return true;
          }

          const format = it.formats[schema];
          if (it.opts.format === "false") {
            return true;
          }

          if (!format && it.opts.unknownFormats != "ignore") {
            throw new Error(`unknown format "${schema}" used in schema at path ${it.schemaPath}`);
          } else if (!format && it.opts.logger != false && it.opts.unknownFormats == "ignore") {
            it.opts.logger.warn(
              `unknown format "${schema}" ignored in schema at path "${it["errSchemaPath"]}"`
            );
            return true;
          }

          if (parentSchema["type"] != ((typeof format == "object" && format.type) || "string")) {
            return true;
          }

          let validate: any = format.validate ? format.validate : format;

          if (typeof validate == "string") {
            validate = new RegExp(validate);
          }

          let passed = false;
          if (format instanceof RegExp) {
            passed = format.test(data);
          } else if (typeof validate == "function") {
            passed = validate(data);
          }

          if (!passed) {
            validateFn["errors"] = [
              {
                keyword: "format",
                message: `should match format '${schema}'`
              }
            ];
          } else if (typeof format == "object" && format["coerce"]) {
            const propertyName = dataPath.split(".").filter(r => !!r)[it.dataLevel - 1];
            parentData[propertyName] = (format as Format).coerce(data);
          }
          return passed;
        };
      }
    });
  }

  private _fetch(uri: string): Promise<Object> {
    for (const interceptor of this._resolvers) {
      const result = interceptor(uri);
      if (!!result) {
        return from(result).toPromise();
      }
    }
    return request({uri, json: true}).catch(() =>
      Promise.reject(new Error(`Cannot resolve the schema ${uri}`))
    );
  }

  registerUriResolver(uriResolver: UriResolver) {
    this._resolvers.add(uriResolver);
  }

  registerDefault(def: Default) {
    this._defaults.set(def.keyword, def);
  }

  registerKeyword(name: string, def: ajv.KeywordDefinition) {
    this._ajv.removeKeyword(name);
    this._ajv.addKeyword(name, def);
  }

  removeSchema(schemaUri?: string) {
    this._ajv.removeSchema(schemaUri);
  }

  async validate(schema: object, value?: any) {
    const validate = await this._ajv.compileAsync(schema);
    return Promise.resolve(validate(value)).then(valid =>
      valid ? valid : Promise.reject(new ajv.ValidationError(validate.errors))
    );
  }
}
