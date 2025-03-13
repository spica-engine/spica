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

export type FunctionWithDependencies<ER extends EnvRelation = EnvRelation.NotResolved> =
  Function<ER> & {
    dependencies: Dependency;
  };

export interface FunctionRepresentative<ER extends EnvRelation = EnvRelation.NotResolved> {
  _id: any;
  module?: "function";
  contents: FunctionContents<ER>;
}

export interface FunctionContents<ER extends EnvRelation = EnvRelation.NotResolved> {
  schema: Function<ER>;
  package: {
    dependencies: Dependency;
  };
  env: Environment;
  index: string;
}
