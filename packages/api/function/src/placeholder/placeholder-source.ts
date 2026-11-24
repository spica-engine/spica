import {EnvRelation, Function, SecretRelation} from "@spica-server/interface-function";
import {PlaceholderPrefix} from "./placeholder-text.js";

export type RuntimeFunction = Function<EnvRelation.Resolved, SecretRelation.Resolved>;

export interface PlaceholderSource {
  readonly prefix: PlaceholderPrefix;
  load(fn: RuntimeFunction): Map<string, string>;
}

export const PLACEHOLDER_SOURCES = Symbol("PLACEHOLDER_SOURCES");
