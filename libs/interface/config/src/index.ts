import {JSONSchema7} from "json-schema";

export interface BaseConfig<T = unknown> {
  module: string;
  options: T;
}

export interface PasswordPolicy {
  minLength?: number;
  minLowercase?: number;
  minUppercase?: number;
  minNumber?: number;
  minSpecialCharacter?: number;
}

export interface PassportPasswordConfigOptions {
  identity?: {password?: PasswordPolicy};
  user?: {password?: PasswordPolicy};
}

export const BASE_CONFIG_SERVICE = "BASE_CONFIG_SERVICE";

export type RegisterConfigSchema = (module: string, optionsSchema: JSONSchema7) => void;
export const REGISTER_CONFIG_SCHEMA = Symbol.for("REGISTER_CONFIG_SCHEMA");
