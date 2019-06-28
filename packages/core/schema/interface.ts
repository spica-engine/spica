import {Observable} from "rxjs";
import {FormatDefinition, KeywordDefinition} from "ajv";

export const SCHEMA_FORMAT = "SCHEMA_FORMAT";

export const SCHEMA_KEYWORD = "SCHEMA_KEYWORD";

export const SCHEMA_DEFAULT = "SCHEMA_DEFAULT";

export const LOCAL_SCHEMAS = "LOCAL_SCHEMAS";

export type UriResolver = (uri: string) => Observable<object> | Promise<object> | null | undefined;

export interface Default {
  keyword: string;
  type: string;
  create(data: unknown): unknown;
}

export type Format = FormatDefinition & {
  name: string;
  coerce?: (val: any) => any;
};

export type Keyword = KeywordDefinition & {name: string};

export interface ModuleOptions {
  schemas?: Object[];
  defaults?: Default[];
  keywords?: Keyword[];
  formats?: FormatDefinition[];
}
