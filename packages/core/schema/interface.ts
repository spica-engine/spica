import {FormatDefinition, KeywordDefinition} from "ajv";
import {Observable} from "rxjs";

export const GLOBAL_SCHEMA_MODULE_OPTIONS = "GLOBAL_SCHEMA_MODULE_OPTIONS";

export const SCHEMA_MODULE_OPTIONS = "SCHEMA_MODULE_OPTIONS";

export type UriResolver = (uri: string) => Observable<object> | Promise<object> | null | undefined;

export interface Default {
  match: string;
  type: string;
  create(data: unknown): unknown;
}

export type Format = FormatDefinition<any> & {
  name: string;
  coerce?: (val: any) => any;
};

export type Keyword = KeywordDefinition & {name: string};

export interface ModuleOptions {
  schemas?: Object[];
  defaults?: Default[];
  keywords?: Keyword[];
  formats?: Format[];
}
