import {InjectionToken} from "@angular/core";

export interface LayoutConfig {
  defaultLayout?: any;
}

export const DEFAULT_LAYOUT = new InjectionToken<any>("PRIMARY_LAYOUT");
export const LAYOUT_ACTIONS = new InjectionToken<any>("LAYOUT_ACTIONS");

export const LAYOUT_INITIALIZER = new InjectionToken<any>("LAYOUT_INITIALIZER");

export type IgnoreHttpError = (path: string, code: number) => boolean;
export const IGNORE_HTTP_ERRORS = new InjectionToken<IgnoreHttpError>("IGNORE_HTTP_ERRORS");
