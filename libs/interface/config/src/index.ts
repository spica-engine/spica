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
