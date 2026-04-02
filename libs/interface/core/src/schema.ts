import {FormatValidator, AsyncFormatValidator, ErrorObject} from "ajv/dist/types";
import {
  CodeKeywordDefinition,
  FormatDefinition,
  KeywordDefinition,
  FuncKeywordDefinition,
  MacroKeywordDefinition,
  Vocabulary
} from "ajv";
import {Observable} from "rxjs";

export type FormatValidate =
  | FormatValidator<string>
  | FormatValidator<number>
  | AsyncFormatValidator<string>
  | AsyncFormatValidator<number>
  | RegExp
  | string
  | true;

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

export type Keyword =
  | KeywordDefinition
  | CodeKeywordDefinition
  | FuncKeywordDefinition
  | MacroKeywordDefinition;

export interface ModuleOptions {
  schemas?: Object[];
  defaults?: Default[];
  keywords?: Keyword[];
  formats?: Format[];
  customFields?: Vocabulary;
}
