export interface BaseConfig<T = unknown> {
  module: string;
  options: T;
}

export const BASE_CONFIG_SERVICE = "BASE_CONFIG_SERVICE";
