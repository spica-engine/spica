import {Inject, Injectable, Optional} from "@nestjs/common";
import {default as Ajv, KeywordDefinition} from "ajv";
import * as request from "request-promise-native";
import {from, isObservable} from "rxjs";
import {skip, take} from "rxjs/operators";
import {
  Default,
  Format,
  GLOBAL_SCHEMA_MODULE_OPTIONS,
  ModuleOptions,
  SCHEMA_MODULE_OPTIONS,
  UriResolver
} from "./interface";
import formatVocabulary from "./format";
export {ValidationError} from "ajv/dist/compile/error_classes"

@Injectable()
export class Validator {
  private _ajv: Ajv;
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
    this._ajv = new Ajv({
      removeAdditional: true,
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
    // this.registerKeyword("default", {
    //   modifying: true,
    //   code: (cxt) => {
    //     return (data, dataPath, parentData) => {
    //       const defaultValueHandler = this._defaults.get(schema);
    //       // TODO(thesayyn): Check type of the default value handler against schema type;
    //       if (defaultValueHandler) {
    //         const propertyName = dataPath.split(".").filter(r => !!r)[it.dataLevel - 1];
    //         parentData[propertyName] = defaultValueHandler.create(
    //           data == defaultValueHandler.keyword ? undefined : data
    //         );
    //       }
    //       return true;
    //     };
    //   }
    // });
    this._ajv.removeKeyword("format");
    this._ajv.addKeyword(formatVocabulary);
  }

  private _fetch(uri: string): Promise<Object> {
    for (const interceptor of this._resolvers) {
      const result = interceptor(uri);
      if (!!result) {
        if (isObservable<Object>(result)) {
          result.pipe(skip(1)).subscribe({
            next: schema => {
              this._ajv.removeSchema(uri);
              this._ajv.addSchema(schema);
            },
            complete: () => this.removeSchema(uri)
          });
          return result.pipe(take(1)).toPromise();
        } else {
          return from(result).toPromise();
        }
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

  registerKeyword(name: string, def: KeywordDefinition) {
    this._ajv.removeKeyword(name);
    this._ajv.addKeyword(name, def);
  }

  removeSchema(schemaUri?: string) {
    this._ajv.removeSchema(schemaUri);
  }

  async validate(schema: object, value?: any) {
    const validate = await this._ajv.compileAsync(schema);
    return Promise.resolve(validate(value)).then(valid =>
      valid ? valid : Promise.reject(new Ajv.ValidationError(validate.errors))
    );
  }
}
