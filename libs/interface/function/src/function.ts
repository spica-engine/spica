import {JSONSchema7} from "json-schema";
import {Observable} from "rxjs";
import {EnvVar} from "@spica-server/interface/env_var";
import {ObjectId} from "@spica-server/database";

export enum EnvRelation {
  Resolved,
  NotResolved
}

export interface Function<ER extends EnvRelation = EnvRelation.NotResolved> {
  _id?: any;
  name: string;
  description?: string;
  env_vars?: ER extends EnvRelation.Resolved ? EnvVar[] : ObjectId[];
  triggers: Triggers;
  timeout: number;
  language: string;
}

export interface Triggers {
  [key: string]: Trigger;
}

export interface Trigger {
  type: string;
  active?: boolean;
  options: any;
}

export interface Environment {
  [key: string]: string;
}

export interface Dependency {
  [key: string]: string;
}

export type FunctionWithDependencies = Function & {dependencies: Dependency};

export interface FunctionRepresentative {
  _id: any;
  module?: "function";
  contents: FunctionContents;
}

export interface FunctionContents {
  schema: Function;
  package: {
    dependencies: Dependency;
  };
  env: {
    [key: string]: string;
  };
  index: string;
}

type Schema = JSONSchema7 | ((observe: boolean) => Promise<JSONSchema7> | Observable<JSONSchema7>);

export type SchemaWithName = {name: string; schema: Schema};

export enum ChangeKind {
  Added = 0,
  Removed = 1,
  Updated = 2
}

export interface Context {
  timeout: number;
  env: Environment;
}

export interface TargetChange {
  kind: ChangeKind;
  type?: string;
  options?: unknown;
  target: {
    id: string;
    handler?: string;
    context?: Context;
  };
}

export type FunctionChange = {_id: string; fn: Function; content: string};

export const SCHEMA = Symbol.for("FUNCTION_ENQUEUER_SCHEMA");
