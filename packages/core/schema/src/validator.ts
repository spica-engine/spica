import {Inject, Injectable, Optional} from "@nestjs/common";
import {default as Ajv, ValidateFunction} from "ajv";
import formats from "ajv-formats";
import {ValidationError} from "ajv/dist/compile/error_classes";
import axios from "axios";
import {from, isObservable} from "rxjs";
import {skip, take, tap} from "rxjs/operators";
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
export {CodeKeywordDefinition, ErrorObject, KeywordCxt, _} from "ajv";
export {ValidationError} from "ajv/dist/compile/error_classes";

@Injectable()
export class Validator {
  private _ajv: Ajv;
  private _resolvers = new Set<UriResolver>();
  private _defaults: Map<string, Default>;

  get defaults(): Default[] {
    return Array.from(this._defaults.values());
  }

  constructor(
    @Inject(SCHEMA_MODULE_OPTIONS) local: ModuleOptions = {},
    @Optional() @Inject(GLOBAL_SCHEMA_MODULE_OPTIONS) global: ModuleOptions = {}
  ) {
    this._defaults = new Map<string, Default>(
      [...(local.defaults || []), ...(global.defaults || [])].map(def => [def.match, def])
    );
    this._ajv = new Ajv({
      useDefaults: true,
      removeAdditional: false,
      loadSchema: uri => this._fetch(uri),
      formats: new Array<Format>()
        .concat(local.formats || [])
        .concat(global.formats || [])
        .reduce((formats, format) => {
          formats[format.name] = format;
          return formats;
        }, {}),
      schemas: new Array().concat(local.schemas || []).concat(global.schemas || []),
      strict: true,
      ["defaults" as any]: this._defaults
    });

    this.registerKeyword(defaultVocabulary);
    this.registerKeyword(formatVocabulary);

    const customFields = (global.customFields ? global.customFields : []).concat(
      local.customFields ? local.customFields : []
    );
    this._ajv.addVocabulary(customFields);

    for (const keyword of new Array<Keyword>()
      .concat(local.keywords || [])
      .concat(global.keywords || [])) {
      this.registerKeyword(keyword);
    }

    formats(this._ajv as any, {formats: ["regex"]});
  }

  private _fetch(uri: string): Promise<Object> {
    for (const interceptor of this._resolvers) {
      const result = interceptor(uri);
      if (!!result) {
        if (isObservable(result)) {
          result
            .pipe(
              skip(1),
              tap(schema => {
                this._ajv.removeSchema(uri);
                this._ajv.addSchema(schema, uri);
              })
            )
            .subscribe();
          return result.pipe(take(1)).toPromise();
        } else {
          return from(result).toPromise();
        }
      }
    }
    return axios.get(uri).then(r => r.data).catch(() =>
      Promise.reject(new Error(`Could not resolve the schema ${uri}`))
    );
  }

  registerUriResolver(uriResolver: UriResolver) {
    this._resolvers.add(uriResolver);
  }

  registerDefault(def: Default) {
    this._defaults.set(def.match, def);
  }

  registerKeyword(def: Keyword): void {
    this._ajv.removeKeyword(def.keyword as string);
    this._ajv.addKeyword(def);
  }

  removeSchema(schemaUri?: string) {
    this._ajv.removeSchema(schemaUri);
  }

  private isId(schemaOrId: object | string): schemaOrId is string {
    return typeof schemaOrId == "string";
  }

  private isSchema(schemaOrId: object | string): schemaOrId is object {
    return typeof schemaOrId == "object" && schemaOrId != null;
  }

  async validate<T = unknown>(schemaOrId: object | string, value: T): Promise<void> {
    let schema: object;
    let uri: string;

    if (this.isSchema(schemaOrId)) {
      schema = schemaOrId;
      uri = schemaOrId["$id"];
    } else if (this.isId(schemaOrId)) {
      schema = {$ref: schemaOrId};
      uri = schemaOrId;
    } else {
      throw new TypeError(`invalid schema type received ${typeof schemaOrId}`);
    }

    try {
      let validate;
      if (uri) {
        validate = this._ajv.getSchema(uri);
      }

      if (!validate) {
        validate = await this._ajv.compileAsync(schema);
      }

      const valid = validate(value);
      if (!valid) {
        throw new ValidationError(validate.errors);
      }
    } catch (e) {
      throw e;
    }
  }
}
