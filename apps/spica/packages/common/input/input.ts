import {InjectionToken} from "@angular/core";
import {JSONSchema7, JSONSchema7TypeName} from "json-schema";

export interface InputSchema extends JSONSchema7 {
  type: JSONSchema7TypeName | any;
}

export interface InternalPropertySchema extends InputSchema {
  $required: boolean;
  $name: string;
}

export const INPUT_SCHEMA = new InjectionToken<InputSchema>("INPUT_SCHEMA");

export interface InputPlacerWithMetaPlacer {
  origin: JSONSchema7TypeName;
  type: string;
  placer: any;
  color: string;
  icon: string;
  metaPlacer?: any;
  coerce?: () => any;
  title?: string;
}

export const INPUT_PLACERS = new InjectionToken<InputPlacerWithMetaPlacer[]>("INPUT_PLACERS");

export const EMPTY_INPUT_SCHEMA: InputSchema = {
  title: undefined,
  type: undefined
};

export const getDefaultArrayItems: () => InputSchema = () => {
  return {
    title: "Title of the items",
    type: "string"
  };
};
