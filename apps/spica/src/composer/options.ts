import {InjectionToken} from "@angular/core";

export const COMPOSER_OPTIONS = new InjectionToken<ComposerOptions>("COMPOSER_OPTIONS");

export interface ComposerOptions {
  url?: string;
}
