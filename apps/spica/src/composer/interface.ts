import * as jsonSchema from "json-schema";

export const ELEMENT_SCHEMA_URL = "http://schemas.lightningcms.io/composer/element";
export const SERVICE_SCHEMA_URL = "http://schemas.lightningcms.io/composer/service";

export interface Collection {
  name: string;
  version: string;
  services?: ServiceSchema[];
  elements?: ElementSchema[];
}

interface EntryPoint {
  importSpecifier: string;
  moduleSpecifier: string;
}

interface BaseSchema {
  name: string;
  $entrypoint?: EntryPoint & {
    dependencies?: EntryPoint[];
  };
}

export const enum ElementFlags {
  Slotted = 1 << 0
}

export type ElementSchema = BaseSchema &
  jsonSchema.JSONSchema7 & {
    flags?: ElementFlags;
    icon?: string;
    slot?: string[] | string;
  };

export interface ServiceSchema extends BaseSchema {
  icon: string;
  methods: {
    [key: string]: {
      parameters: {[key: string]: jsonSchema.JSONSchema6Definition};
      returnType?: (args: any) => jsonSchema.JSONSchema6TypeName;
    };
  };
}

export interface Page {
  component: string;
  path: string;
  source: string;
}

export interface Palette {
  name: string;
  colors: ColorPair;
  names: ColorPair;
}
export interface ColorPair {
  [key: string]: string;
}
