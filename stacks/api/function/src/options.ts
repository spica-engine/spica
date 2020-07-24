import {SchedulingOptions} from "@spica-server/function/scheduler";
import {CorsOptions} from "@spica-server/core/interfaces";

export const FUNCTION_OPTIONS = Symbol.for("FUNCTION_OPTIONS");

export interface Options {
  timeout: number;
  root: string;
  corsOptions: CorsOptions;
}

export interface FunctionOptions extends SchedulingOptions {
  path: string;
  corsOptions: CorsOptions;
}
