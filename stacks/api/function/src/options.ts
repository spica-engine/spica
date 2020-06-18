import {HorizonOptions} from "@spica-server/function/horizon";

export const FUNCTION_OPTIONS = Symbol.for("FUNCTION_OPTIONS");

export interface Options {
  timeout: number;
  root: string;
} 

export interface FunctionOptions extends HorizonOptions {
  path: string;
}

