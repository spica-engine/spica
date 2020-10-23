import {Inject, Injectable, Optional} from "@nestjs/common";
import {default as Ajv, KeywordDefinition} from "ajv";
import * as request from "request-promise-native";
import {from, isObservable} from "rxjs";
import {skip, take} from "rxjs/operators";
import defaultVocabulary from "./default";
import formatVocabulary from "./format";
import {
  Default,
  Format,
  GLOBAL_SCHEMA_MODULE_OPTIONS,
  Keyword,
  ModuleOptions,
  SCHEMA_MODULE_OPTIONS,
  UriResolver
} from "./interface";
export {ValidationError} from "ajv/dist/compile/error_classes";

@Injectable()
export class Validator {
  private _ajv: Ajv;
  private _resolvers = new Set<UriResolver>();
  private _defaults: Map<string, Default>;

  constructor(
    @Inject(SCHEMA_MODULE_OPTIONS) local: ModuleOptions = {},
    @Optional() @Inject(GLOBAL_SCHEMA_MODULE_OPTIONS) global: ModuleOptions = {}
  ) {
    this._defaults =  new Map<string, Default>(
      [...(local.defaults || []), ...(global.defaults || [])].map(def => [def.match, def])
    );
    this._ajv = new Ajv({
      removeAdditional: true,
      useDefaults: true,
      validateSchema: false,
      loadSchema: uri => this._fetch(uri),
      formats: new Array<Format>().concat(local.formats || []).concat(global.formats || []).reduce((formats, format) => {
        formats[format.name] = format;
        return formats;
      }, {}),
      schemas: new Array().concat(local.schemas|| []).concat(global.schemas|| []),
      ['defaults' as any]: this._defaults
    });
 
    for (const keyword of new Array<Keyword>().concat(local.keywords|| []).concat(global.keywords|| [])) {
      this.registerKeyword(keyword.name, keyword)
    }

    this._ajv.removeKeyword("default");
    this._ajv.addKeyword(defaultVocabulary);
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
    this._defaults.set(def.match, def);
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
