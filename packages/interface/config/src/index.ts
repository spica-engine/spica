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

export const BASE_CONFIG_SERVICE = "BASE_CONFIG_SERVICE";

export type RegisterConfigSchema = (module: string, optionsSchema: JSONSchema7) => void;
export const REGISTER_CONFIG_SCHEMA = Symbol.for("REGISTER_CONFIG_SCHEMA");

export interface ConfigRepository {
  findByModule(module: string): Promise<BaseConfig | null>;
  /**
   * Replaces the module's config, inserting it when missing, and resolves to the stored config.
   */
  replaceByModule(module: string, config: BaseConfig): Promise<BaseConfig>;
  /**
   * Sets the module's options, inserting the config when missing.
   */
  setOptions(module: string, options: object): Promise<void>;
  /**
   * Sets one option of the module, inserting the config when missing.
   */
  setOption(module: string, name: string, value: unknown): Promise<void>;
}

export const CONFIG_REPOSITORY = Symbol.for("CONFIG_REPOSITORY");
