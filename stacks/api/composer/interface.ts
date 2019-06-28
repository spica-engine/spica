import {ColorPair} from "./palette";

export const COMPOSER_OPTIONS = "COMPOSER_OPTIONS";

export interface ComposerOptions {
  version?: string;
  /* Accessible rest api url for composer project */
  serverUrl: string;
  path: string;
}

export interface ProjectOptions {
  name: string;
  colors: ColorPair;
  font: string;
}
